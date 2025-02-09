package plugins

import (
	"zombiezen.com/go/sqlite"
)

var _pluginName string

type Database[PluginConfig any] struct {
	_config       *ProjectConfig
	_pluginConfig *PluginConfig
	*sqlite.Conn
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

func (db Database[PluginConfig]) ExecStatement(statement *sqlite.Stmt) error {
	if _, err := statement.Step(); err != nil {
		return err
	}
	return statement.Reset()
}
