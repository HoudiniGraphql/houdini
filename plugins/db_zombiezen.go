//go:build !wasip1

package plugins

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"zombiezen.com/go/sqlite"
	"zombiezen.com/go/sqlite/sqlitex"
)

// DatabasePool holds the connection pool and plugin configuration.
type DatabasePool[PC any] struct {
	_config       *ProjectConfig
	_pluginConfig *PC
	*sqlitex.Pool
	PluginName string
	Test       bool
}

// zombiezenStmt wraps *sqlite.Stmt to satisfy the Stmt interface,
// adapting ColumnType to return ColumnKind instead of sqlite.ColumnType.
type zombiezenStmt struct{ s *sqlite.Stmt }

func (z zombiezenStmt) ColumnText(i int) string          { return z.s.ColumnText(i) }
func (z zombiezenStmt) GetText(col string) string         { return z.s.GetText(col) }
func (z zombiezenStmt) ColumnInt(i int) int               { return z.s.ColumnInt(i) }
func (z zombiezenStmt) ColumnInt64(i int) int64           { return z.s.ColumnInt64(i) }
func (z zombiezenStmt) GetInt64(col string) int64         { return z.s.GetInt64(col) }
func (z zombiezenStmt) ColumnBool(i int) bool             { return z.s.ColumnBool(i) }
func (z zombiezenStmt) GetBool(col string) bool           { return z.s.GetBool(col) }
func (z zombiezenStmt) ColumnIsNull(i int) bool           { return z.s.ColumnIsNull(i) }
func (z zombiezenStmt) IsNull(col string) bool            { return z.s.IsNull(col) }
func (z zombiezenStmt) ColumnType(i int) ColumnKind       { return ColumnKind(z.s.ColumnType(i)) }
func (z zombiezenStmt) SetText(param string, value string) { z.s.SetText(param, value) }
func (z zombiezenStmt) SetInt64(param string, value int64) { z.s.SetInt64(param, value) }
func (z zombiezenStmt) SetNull(param string)               { z.s.SetNull(param) }
func (z zombiezenStmt) SetBool(param string, value bool)   { z.s.SetBool(param, value) }
func (z zombiezenStmt) BindText(i int, value string)       { z.s.BindText(i, value) }
func (z zombiezenStmt) BindInt64(i int, value int64)       { z.s.BindInt64(i, value) }
func (z zombiezenStmt) BindParamCount() int                { return z.s.BindParamCount() }
func (z zombiezenStmt) BindParamName(i int) string         { return z.s.BindParamName(i) }
func (z zombiezenStmt) Step() (bool, error)                { return z.s.Step() }
func (z zombiezenStmt) Reset() error                       { return z.s.Reset() }
func (z zombiezenStmt) ClearBindings() error               { return z.s.ClearBindings() }
func (z zombiezenStmt) Finalize() error                    { return z.s.Finalize() }

// zombiezenConn wraps a *sqlite.Conn to satisfy the Conn interface.
type zombiezenConn struct{ c *sqlite.Conn }

func (z zombiezenConn) Prepare(query string) (Stmt, error) {
	s, err := z.c.Prepare(query)
	if err != nil {
		return nil, err
	}
	return zombiezenStmt{s: s}, nil
}

func (z zombiezenConn) LastInsertRowID() int64 {
	return z.c.LastInsertRowID()
}

// Transaction wraps sqlitex.Transaction for use with Conn.
func (db DatabasePool[PC]) Transaction(conn Conn) func(*error) {
	zc, ok := conn.(zombiezenConn)
	if !ok {
		return func(errp *error) {
			if *errp == nil {
				*errp = fmt.Errorf("Transaction: expected zombiezenConn, got %T", conn)
			}
		}
	}
	end := sqlitex.Transaction(zc.c)
	// defer_foreign_keys resets to OFF at the end of every transaction, so it has
	// to be re-enabled after each BEGIN — pipeline steps batch-insert rows that
	// temporarily violate FK integrity, and the checks belong at COMMIT.
	if err := sqlitex.ExecuteTransient(zc.c, "PRAGMA defer_foreign_keys = ON", nil); err != nil {
		return func(errp *error) {
			if *errp == nil {
				*errp = err
			}
			end(errp)
		}
	}
	return end
}

func (db *DatabasePool[PC]) SetProjectConfig(config ProjectConfig) {
	db._config = &config
}

func (db *DatabasePool[PC]) SetPluginConfig(config PC) {
	db._pluginConfig = &config
}

var connectionPragmas = []string{
	"PRAGMA journal_mode = WAL",
	"PRAGMA synchronous = off",
	"PRAGMA cache_size = 10000",
	"PRAGMA temp_store = memory",
	"PRAGMA busy_timeout = 5000",
	"PRAGMA foreign_keys = ON",
	// deferral is re-enabled per transaction in Transaction() — the pragma
	// auto-resets at the end of every transaction, so setting it here only
	// covers statements that run outside an explicit transaction
	"PRAGMA defer_foreign_keys = ON",
}

func prepareConn(conn *sqlite.Conn) error {
	for _, pragma := range connectionPragmas {
		if err := sqlitex.ExecuteTransient(conn, pragma, nil); err != nil {
			return err
		}
	}
	return nil
}

func NewPool[PC any]() (DatabasePool[PC], error) {
	pool, err := sqlitex.NewPool(databasePath, sqlitex.PoolOptions{
		Flags:       sqlite.OpenWAL | sqlite.OpenReadWrite,
		PrepareConn: prepareConn,
	})
	if err != nil {
		return DatabasePool[PC]{}, err
	}

	return DatabasePool[PC]{Pool: pool}, nil
}

func NewTestPool[PC any]() (DatabasePool[PC], error) {
	pool, err := sqlitex.NewPool("file:shared?mode=memory&cache=shared", sqlitex.PoolOptions{
		Flags: sqlite.OpenWAL | sqlite.OpenReadWrite | sqlite.OpenMemory | sqlite.OpenURI,
		// tests must run under the same constraint semantics as production —
		// without foreign_keys enforcement a pipeline bug that violates FK
		// integrity passes every table test and only surfaces in e2e apps
		PrepareConn: prepareConn,
	})
	if err != nil {
		return DatabasePool[PC]{}, err
	}

	return DatabasePool[PC]{Pool: pool, Test: true}, nil
}

// Close closes the underlying pool.
func (db DatabasePool[PC]) Close() error {
	return db.Pool.Close()
}

// Take checks out a connection from the pool and returns it as a Conn.
func (db DatabasePool[PC]) Take(ctx context.Context) (Conn, error) {
	c, err := db.Pool.Take(ctx)
	if err != nil {
		return nil, err
	}
	return zombiezenConn{c: c}, nil
}

// Put returns a connection to the pool.
func (db DatabasePool[PC]) Put(conn Conn) {
	zc := conn.(zombiezenConn)
	db.Pool.Put(zc.c)
}

func (db DatabasePool[PC]) ExecStatement(
	statement Stmt,
	args map[string]any,
) error {
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

	// Clear all named parameters to prevent state retention between executions
	// ClearBindings() only clears numbered parameters, not named ones set via SetText()
	if err := clearAllNamedParameters(statement); err != nil {
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

	// nothing went wrong
	return nil
}

func (db DatabasePool[PC]) ExecQuery(
	ctx context.Context,
	query string,
	args map[string]any,
) error {
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

// StepQuery wraps the common steps for executing a query.
// It obtains the connection, prepares the query, iterates over rows, and calls the rowHandler callback for each row.
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

	// apply any bindings if they exist
	if bindings != nil {
		err = db.BindStatement(query, bindings)
		if err != nil {
			return &Error{
				Message: fmt.Sprintf("could not bind statement: %v", err),
			}
		}
	}

	// if there is a $task_id binding, we need to bind it
	bindTaskID(ctx, query)

	return db.StepStatement(ctx, query, func() {
		rowHandler(query)
	})
}

func bindTaskID(ctx context.Context, statement Stmt) {
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
	// if there is a $task_id binding, we need to bind it
	bindTaskID(ctx, queryStatement)

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

	// Clear all named parameters to prevent state retention between executions
	// ClearBindings() only clears numbered parameters, not named ones set via SetText()
	if err := clearAllNamedParameters(queryStatement); err != nil {
		return err
	}

	return nil
}

// clearAllNamedParameters clears named parameter bindings on a statement, except for
// parameters that are intended to be persistent across executions.
// This addresses a SQLite behavior where named parameters set via SetText() are not
// cleared by ClearBindings(), causing state retention between statement executions.
func clearAllNamedParameters(statement Stmt) error {
	// Iterate through all parameters and clear non-persistent ones
	for i := range statement.BindParamCount() {
		paramName := statement.BindParamName(i + 1)
		if paramName != "" && paramName != "$task_id" &&
			!strings.HasSuffix(paramName, "directive") {
			// Set the parameter to NULL to clear any previous binding
			// This ensures that non-persistent named parameters don't retain values between executions
			statement.SetNull(paramName)
		}
	}
	return nil
}
