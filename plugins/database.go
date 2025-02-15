package plugins

import (
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
