package plugins

import (
	"fmt"

	"zombiezen.com/go/sqlite"
)

var _pluginName string

type Database[PluginConfig any] struct {
	_config       *ProjectConfig
	_pluginConfig *PluginConfig
	*sqlite.Conn
}

func (db *Database[PluginConfig]) SetProjectConfig(config ProjectConfig) {
	db._config = &config
}

func (db *Database[PluginConfig]) SetPluginConfig(config PluginConfig) {
	db._pluginConfig = &config
}

func ConnectDB[PluginConfig any]() (Database[PluginConfig], error) {
	conn, err := sqlite.OpenConn(databasePath, sqlite.OpenWAL, sqlite.OpenReadWrite)
	if err != nil {
		return Database[PluginConfig]{}, err
	}

	return Database[PluginConfig]{Conn: conn}, nil
}

func InMemoryDB[PluginConfig any]() (Database[PluginConfig], error) {
	conn, err := sqlite.OpenConn(":memory:", sqlite.OpenWAL, sqlite.OpenReadWrite)
	if err != nil {
		return Database[PluginConfig]{}, err
	}

	return Database[PluginConfig]{Conn: conn}, nil
}

func InMemorySharedDB[PluginConfig any]() (Database[PluginConfig], error) {
	conn, err := sqlite.OpenConn("file:memdb1", sqlite.OpenWAL, sqlite.OpenMemory, sqlite.OpenReadWrite, sqlite.OpenSharedCache)
	if err != nil {
		return Database[PluginConfig]{}, err
	}

	return Database[PluginConfig]{Conn: conn}, nil
}

func (db Database[PluginConfig]) ExecStatement(statement *sqlite.Stmt, args ...any) error {
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
