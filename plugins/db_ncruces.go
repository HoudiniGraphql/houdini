//go:build wasip1

package plugins

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"

	_ "github.com/ncruces/go-sqlite3/driver"
	// embed is NOT imported: wasip1 uses the host's SQLite via WASI syscalls.
	// Importing embed would bundle a ~9MB SQLite WASM inside the binary for no reason.
)

var paramRe = regexp.MustCompile(`\$[A-Za-z_][A-Za-z0-9_]*`)

var databasePath string = ""
var spCounter atomic.Int64

// DatabasePool holds the database connection and plugin configuration.
type DatabasePool[PC any] struct {
	_config       *ProjectConfig
	_pluginConfig *PC
	db            *sql.DB
	mu            sync.Mutex
	PluginName    string
	Test          bool
}

// ncrucesConn is a checked-out connection wrapper that satisfies Conn.
type ncrucesConn struct {
	db       *sql.DB
	mu       *sync.Mutex
	lastID   int64
	lastIDMu sync.Mutex
}

func (c *ncrucesConn) Prepare(query string) (Stmt, error) {
	return &ncrucesStmt{
		db:    c.db,
		query: query,
		conn:  c,
	}, nil
}

func (c *ncrucesConn) LastInsertRowID() int64 {
	c.lastIDMu.Lock()
	defer c.lastIDMu.Unlock()
	return c.lastID
}

func (c *ncrucesConn) setLastID(id int64) {
	c.lastIDMu.Lock()
	defer c.lastIDMu.Unlock()
	c.lastID = id
}

// ncrucesStmt implements the Stmt interface over database/sql.
// SELECT results are eagerly fetched into cachedRows so the connection is
// released immediately, allowing SetMaxOpenConns(1) without deadlock.
type ncrucesStmt struct {
	db          *sql.DB
	query       string
	conn        *ncrucesConn
	namedParams map[string]any
	posParams   map[int]any
	colNames    []string
	scanned     []any
	cachedRows  [][]any
	cachedIdx   int
}

func (s *ncrucesStmt) ensureParams() {
	if s.namedParams == nil {
		s.namedParams = map[string]any{}
	}
	if s.posParams == nil {
		s.posParams = map[int]any{}
	}
}

func (s *ncrucesStmt) SetText(param string, value string)  { s.ensureParams(); s.namedParams[param] = value }
func (s *ncrucesStmt) SetInt64(param string, value int64)  { s.ensureParams(); s.namedParams[param] = value }
func (s *ncrucesStmt) SetNull(param string)                { s.ensureParams(); s.namedParams[param] = nil }
func (s *ncrucesStmt) SetBool(param string, value bool)    { s.ensureParams(); s.namedParams[param] = value }
func (s *ncrucesStmt) BindText(i int, value string)        { s.ensureParams(); s.posParams[i] = value }
func (s *ncrucesStmt) BindInt64(i int, value int64)        { s.ensureParams(); s.posParams[i] = value }

func (s *ncrucesStmt) BindParamCount() int {
	parts := strings.Split(s.query, "$")
	return len(parts) - 1
}

func (s *ncrucesStmt) BindParamName(i int) string {
	matches := paramRe.FindAllString(s.query, -1)
	if i < 1 || i > len(matches) {
		return ""
	}
	return matches[i-1]
}

func (s *ncrucesStmt) buildArgs() []any {
	s.ensureParams()
	// Merge positional params into namedParams by resolving the param name at
	// each position (e.g. BindText(2, alias) → namedParams["$alias"] = alias).
	// This lets callers use BindText(i, v) alongside SetText("$name", v) without
	// the two binding styles conflicting.
	for i, v := range s.posParams {
		if name := s.BindParamName(i); name != "" {
			s.namedParams[name] = v
		}
	}
	args := []any{}
	for k, v := range s.namedParams {
		args = append(args, sql.Named(strings.TrimPrefix(k, "$"), v))
	}
	return args
}

func (s *ncrucesStmt) Step() (bool, error) {
	// DML: execute and return immediately (connection released by Exec).
	if s.cachedRows == nil && s.cachedIdx == 0 {
		trimmed := strings.TrimSpace(strings.ToUpper(s.query))
		isDML := strings.HasPrefix(trimmed, "INSERT") ||
			strings.HasPrefix(trimmed, "UPDATE") ||
			strings.HasPrefix(trimmed, "DELETE") ||
			strings.HasPrefix(trimmed, "REPLACE")

		if isDML {
			result, err := s.db.Exec(s.query, s.buildArgs()...)
			if err != nil {
				return false, err
			}
			if id, err := result.LastInsertId(); err == nil {
				s.conn.setLastID(id)
			}
			// Mark as "fetched" so Reset() doesn't re-execute.
			s.cachedRows = [][]any{}
			return false, nil
		}

		// SELECT: eagerly fetch all rows so the connection is released before
		// the caller makes any further queries (required with SetMaxOpenConns(1)).
		rows, err := s.db.Query(s.query, s.buildArgs()...)
		if err != nil {
			return false, err
		}
		cols, err := rows.Columns()
		if err != nil {
			rows.Close()
			return false, err
		}
		s.colNames = cols
		for rows.Next() {
			scanned := make([]any, len(cols))
			ptrs := make([]any, len(cols))
			for i := range scanned {
				ptrs[i] = &scanned[i]
			}
			if err := rows.Scan(ptrs...); err != nil {
				rows.Close()
				return false, err
			}
			s.cachedRows = append(s.cachedRows, scanned)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return false, err
		}
	}

	if s.cachedIdx >= len(s.cachedRows) {
		return false, nil
	}
	s.scanned = s.cachedRows[s.cachedIdx]
	s.cachedIdx++
	return true, nil
}

func (s *ncrucesStmt) Reset() error {
	s.cachedRows = nil
	s.cachedIdx = 0
	s.scanned = nil
	return nil
}

func (s *ncrucesStmt) ClearBindings() error {
	s.namedParams = nil
	s.posParams = nil
	return nil
}

func (s *ncrucesStmt) Finalize() error {
	return s.Reset()
}

func (s *ncrucesStmt) colIndex(col string) int {
	for i, c := range s.colNames {
		if c == col {
			return i
		}
	}
	return -1
}

func (s *ncrucesStmt) ColumnText(i int) string {
	if i < 0 || i >= len(s.scanned) || s.scanned[i] == nil {
		return ""
	}
	switch v := s.scanned[i].(type) {
	case string:
		return v
	case []byte:
		return string(v)
	default:
		return fmt.Sprintf("%v", v)
	}
}

func (s *ncrucesStmt) GetText(col string) string {
	return s.ColumnText(s.colIndex(col))
}

func (s *ncrucesStmt) ColumnInt(i int) int {
	return int(s.ColumnInt64(i))
}

func (s *ncrucesStmt) ColumnInt64(i int) int64 {
	if i < 0 || i >= len(s.scanned) || s.scanned[i] == nil {
		return 0
	}
	switch v := s.scanned[i].(type) {
	case int64:
		return v
	case int:
		return int64(v)
	case float64:
		return int64(v)
	case string:
		var n int64
		fmt.Sscanf(v, "%d", &n)
		return n
	default:
		return 0
	}
}

func (s *ncrucesStmt) GetInt64(col string) int64 {
	return s.ColumnInt64(s.colIndex(col))
}

func (s *ncrucesStmt) ColumnBool(i int) bool {
	return s.ColumnInt64(i) != 0
}

func (s *ncrucesStmt) GetBool(col string) bool {
	return s.ColumnBool(s.colIndex(col))
}

func (s *ncrucesStmt) ColumnIsNull(i int) bool {
	if i < 0 || i >= len(s.scanned) {
		return true
	}
	return s.scanned[i] == nil
}

func (s *ncrucesStmt) IsNull(col string) bool {
	return s.ColumnIsNull(s.colIndex(col))
}

func (s *ncrucesStmt) ColumnType(i int) ColumnKind {
	if i < 0 || i >= len(s.scanned) || s.scanned[i] == nil {
		return ColumnKindNull
	}
	switch s.scanned[i].(type) {
	case int64, int, float64:
		return ColumnKindInt
	case string, []byte:
		return ColumnKindText
	default:
		return ColumnKindNull
	}
}

// Transaction wraps begin/commit/rollback using SQL savepoints so that all
// subsequent Step() calls on the shared db.db connection participate.
func (db DatabasePool[PC]) Transaction(conn Conn) func(*error) {
	sp := fmt.Sprintf("sp_%d", spCounter.Add(1))
	if _, err := db.db.Exec("SAVEPOINT " + sp); err != nil {
		return func(errp *error) {
			if *errp == nil {
				*errp = err
			}
		}
	}
	// Defer FK checks to RELEASE so forward-reference inserts (e.g. type_fields
	// inserted before all referenced types exist) don't fail immediately.
	// This mirrors the zombiezen path's connectionPragmas setup.
	db.db.Exec("PRAGMA defer_foreign_keys = ON")
	return func(errp *error) {
		if *errp != nil {
			db.db.Exec("ROLLBACK TO " + sp)
			db.db.Exec("RELEASE " + sp)
		} else {
			db.db.Exec("RELEASE " + sp)
		}
	}
}

func (db *DatabasePool[PC]) SetProjectConfig(config ProjectConfig) {
	db._config = &config
}

func (db *DatabasePool[PC]) SetPluginConfig(config PC) {
	db._pluginConfig = &config
}

func NewPool[PC any]() (DatabasePool[PC], error) {
	// wasip1 has no file-locking support; nolock=1 tells SQLite to skip locking.
	// Node.js skips WAL mode in stdio transport, so no shared-memory file is needed.
	uri := fmt.Sprintf("file:%s?nolock=1", databasePath)
	db, err := sql.Open("sqlite3", uri)
	if err != nil {
		return DatabasePool[PC]{}, err
	}
	// Single connection ensures SAVEPOINTs and PRAGMA defer_foreign_keys are
	// visible to all subsequent queries on the same connection.
	db.SetMaxOpenConns(1)
	// enforcement is per-connection and off by default; without it the deferral
	// set at each transaction start has nothing to defer
	db.Exec("PRAGMA foreign_keys = ON")
	return DatabasePool[PC]{db: db}, nil
}

func NewTestPool[PC any]() (DatabasePool[PC], error) {
	db, err := sql.Open("sqlite3", "file:shared?mode=memory&cache=shared")
	if err != nil {
		return DatabasePool[PC]{}, err
	}
	return DatabasePool[PC]{db: db, Test: true}, nil
}

func (db DatabasePool[PC]) Close() error {
	return db.db.Close()
}

func (db DatabasePool[PC]) Take(ctx context.Context) (Conn, error) {
	return &ncrucesConn{db: db.db, mu: &db.mu}, nil
}

func (db DatabasePool[PC]) Put(conn Conn) {
	// No-op for sql.DB which manages its own connection pool
}

func (db DatabasePool[PC]) ExecStatement(statement Stmt, args map[string]any) error {
	err := db.BindStatement(statement, args)
	if err != nil {
		return err
	}
	if _, err := statement.Step(); err != nil {
		return err
	}
	if err := statement.Reset(); err != nil {
		return err
	}
	if err := statement.ClearBindings(); err != nil {
		return err
	}
	if err := clearAllNamedParametersNcruces(statement); err != nil {
		return err
	}
	return nil
}

func (db DatabasePool[PC]) BindStatement(stmt Stmt, args map[string]any) error {
	for key, arg := range args {
		switch val := arg.(type) {
		case string:
			stmt.SetText("$"+key, val)
		case int:
			stmt.SetInt64("$"+key, int64(val))
		case int64:
			stmt.SetInt64("$"+key, val)
		case nil:
			stmt.SetNull("$" + key)
		case bool:
			stmt.SetBool("$"+key, val)
		case []string:
			str, err := json.Marshal(val)
			if err != nil {
				return err
			}
			stmt.SetText("$"+key, string(str))
		default:
			return fmt.Errorf("unsupported type: %T", arg)
		}
	}
	return nil
}

func (db DatabasePool[PC]) ExecQuery(ctx context.Context, query string, args map[string]any) error {
	conn, err := db.Take(ctx)
	if err != nil {
		return &Error{
			Message: "could not open connection to database",
			Detail:  err.Error(),
		}
	}
	defer db.Put(conn)
	stmt, err := conn.Prepare(query)
	if err != nil {
		return &Error{
			Message: fmt.Sprintf("could not prepare query: %v", err),
		}
	}
	defer stmt.Finalize()
	return db.ExecStatement(stmt, args)
}

func (db DatabasePool[PC]) StepQuery(
	ctx context.Context,
	queryStr string,
	bindings map[string]any,
	rowHandler func(q Row),
) error {
	conn, err := db.Take(ctx)
	if err != nil {
		return &Error{
			Message: "could not open connection to database",
			Detail:  err.Error(),
		}
	}
	defer db.Put(conn)

	query, err := conn.Prepare(queryStr)
	if err != nil {
		return &Error{
			Message: fmt.Sprintf("could not prepare query: %v", err),
		}
	}
	defer query.Finalize()

	if bindings != nil {
		err = db.BindStatement(query, bindings)
		if err != nil {
			return &Error{
				Message: fmt.Sprintf("could not bind statement: %v", err),
			}
		}
	}

	bindTaskIDNcruces(ctx, query)

	return db.StepStatement(ctx, query, func() {
		rowHandler(query)
	})
}

func bindTaskIDNcruces(ctx context.Context, statement Stmt) {
	taskID := TaskIDFromContext(ctx)
	if taskID != nil {
		for i := range statement.BindParamCount() {
			if statement.BindParamName(i+1) == "$task_id" {
				statement.SetText("$task_id", *taskID)
				break
			}
		}
	}
}

func (db DatabasePool[PC]) StepStatement(
	ctx context.Context,
	queryStatement Stmt,
	rowHandler func(),
) error {
	bindTaskIDNcruces(ctx, queryStatement)

	for {
		select {
		case <-ctx.Done():
			return nil
		default:
		}

		hasData, err := queryStatement.Step()
		if err != nil {
			return errors.New("query step error: " + err.Error())
		}
		if !hasData {
			break
		}
		rowHandler()
	}

	if err := queryStatement.Reset(); err != nil {
		return err
	}
	if err := queryStatement.ClearBindings(); err != nil {
		return err
	}
	if err := clearAllNamedParametersNcruces(queryStatement); err != nil {
		return err
	}

	return nil
}

func ParseFlags() {
	flag.StringVar(&databasePath, "database", "", "")
	// accept --transport and --plugin-key for flag compatibility with native builds
	flag.String("transport", "stdio", "")
	flag.StringVar(&pluginKey, "plugin-key", "", "")
	flag.Parse()

	if databasePath == "" {
		flag.Usage()
		log.Fatal("database path is required")
	}
}

func Run[PC any](plugin HoudiniPlugin[PC]) error {
	ParseFlags()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	db, err := NewPool[PC]()
	if err != nil {
		return err
	}
	defer db.Close()

	db.PluginName = plugin.Name()
	plugin.SetDatabase(db)

	if err := db.ReloadPluginConfig(ctx); err != nil {
		return fmt.Errorf("failed to reload plugin config: %w", err)
	}
	if err := db.ReloadProjectConfig(ctx); err != nil {
		return fmt.Errorf("failed to reload project config: %w", err)
	}

	return runStdio(ctx, plugin)
}

func clearAllNamedParametersNcruces(statement Stmt) error {
	for i := range statement.BindParamCount() {
		paramName := statement.BindParamName(i + 1)
		if paramName != "" && paramName != "$task_id" &&
			!strings.HasSuffix(paramName, "directive") {
			statement.SetNull(paramName)
		}
	}
	return nil
}
