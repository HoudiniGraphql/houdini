package plugins

import (
	"context"
	"errors"
	"fmt"
	"time"

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

func (db DatabasePool[PluginConfig]) ExecStatement(
	statement *sqlite.Stmt,
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

	return nil
}

func (db DatabasePool[PluginConfig]) BindStatement(stmt *sqlite.Stmt, args map[string]any) error {
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
		default:
			return fmt.Errorf("unsupported type: %T", arg)
		}
	}

	// nothing went wrong
	return nil
}

// our wrapper over take needs to time out after 10 seconds
func (db DatabasePool[PluginConfig]) Take(ctx context.Context) (*sqlite.Conn, error) {
	ctx, _ = context.WithTimeout(ctx, 10*time.Second)

	conn, err := db.Pool.Take(ctx)
	if err != nil {
		return nil, err
	}

	return conn, nil
}

// StepQuery wraps the common steps for executing a query.
// It obtains the connection, prepares the query, iterates over rows, and calls the rowHandler callback for each row.
func (db DatabasePool[PluginConfig]) StepQuery(
	ctx context.Context,
	queryStr string,
	bindings map[string]any,
	rowHandler func(q *sqlite.Stmt),
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
	if taskID := TaskIDFromContext(ctx); taskID != nil {
		for i := 0; i < query.BindParamCount(); i++ {
			name := query.BindParamName(i)
			if name == "$task_id" {
				query.SetText("$task_id", *taskID)
				break
			}
		}
	}

	return db.StepStatement(ctx, query, func() {
		rowHandler(query)
	})
}

func (db DatabasePool[PluginConfig]) StepStatement(
	ctx context.Context,
	queryStatement *sqlite.Stmt,
	rowHandler func(),
) error {
	// if there is a $task_id binding, we need to bind it
	if taskID := TaskIDFromContext(ctx); taskID != nil {
		for i := 0; i < queryStatement.BindParamCount(); i++ {
			name := queryStatement.BindParamName(i)
			if name == "$task_id" {
				queryStatement.SetText("$task_id", *taskID)
				break
			}
		}
	}

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

	return nil
}
