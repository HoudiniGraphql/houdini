package plugins

import (
	"context"
	"fmt"

	"zombiezen.com/go/sqlite"
	"zombiezen.com/go/sqlite/sqlitex"
)

var _pluginName string

type DatabasePool[PluginConfig any] struct {
	_config       *ProjectConfig
	_pluginConfig *PluginConfig
	*sqlitex.Pool
}

func (db *DatabasePool[PluginConfig]) SetProjectConfig(config ProjectConfig) {
	db._config = &config
}

func (db *DatabasePool[PluginConfig]) SetPluginConfig(config PluginConfig) {
	db._pluginConfig = &config
}

func NewPool[PluginConfig any]() (DatabasePool[PluginConfig], error) {
	pool, err := sqlitex.NewPool(databasePath, sqlitex.PoolOptions{
		Flags: sqlite.OpenWAL | sqlite.OpenReadWrite,
	})
	if err != nil {
		return DatabasePool[PluginConfig]{}, err
	}

	return DatabasePool[PluginConfig]{Pool: pool}, nil
}

func NewPoolInMemory[PluginConfig any]() (DatabasePool[PluginConfig], error) {
	pool, err := sqlitex.NewPool("file:shared?mode=memory&cache=shared", sqlitex.PoolOptions{
		Flags: sqlite.OpenWAL | sqlite.OpenReadWrite | sqlite.OpenMemory | sqlite.OpenURI,
	})
	if err != nil {
		return DatabasePool[PluginConfig]{}, err
	}

	return DatabasePool[PluginConfig]{Pool: pool}, nil
}

func (db DatabasePool[PluginConfig]) ExecStatement(statement *sqlite.Stmt, args ...any) error {
	for i, arg := range args {
		switch arg.(type) {
		case string:
			statement.BindText(i+1, arg.(string))
		case int:
			statement.BindInt64(i+1, int64(arg.(int)))
		case int64:
			statement.BindInt64(i+1, arg.(int64))
		case nil:
			statement.BindNull(i + 1)
		case bool:
			statement.BindBool(i+1, arg.(bool))
		default:
			return fmt.Errorf("unsupported type: %T", arg)
		}
	}

	if _, err := statement.Step(); err != nil {
		return err
	}
	return statement.Reset()
}

// StepQuery wraps the common steps for executing a query.
// It obtains the connection, prepares the query, iterates over rows, and calls the rowHandler callback for each row.
func (db DatabasePool[PluginConfig]) StepQuery(ctx context.Context, queryStr string, rowHandler func(q *sqlite.Stmt)) *Error {
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
			Message: "could not prepare query",
			Detail:  err.Error(),
		}
	}
	defer query.Finalize()

	return db.StepStatement(ctx, query, func() {
		rowHandler(query)
	})
}

func (db DatabasePool[PluginConfig]) StepStatement(ctx context.Context, queryStatement *sqlite.Stmt, rowHandler func()) *Error {
	for {
		select {
		case <-ctx.Done():
			return nil
		default:
		}

		hasData, err := queryStatement.Step()
		if err != nil {
			return &Error{
				Message: "query step error",
				Detail:  err.Error(),
			}
		}
		if !hasData {
			break
		}
		rowHandler()
	}

	return nil
}
