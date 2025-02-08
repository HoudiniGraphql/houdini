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
	conn, err := sqlite.OpenConn(databasePath, sqlite.OpenReadWrite)
	if err != nil {
		return Database[PluginConfig]{}, err
	}

	return Database[PluginConfig]{Conn: conn}, nil
}

func InMemoryDB[PluginConfig any]() (Database[PluginConfig], error) {
	conn, err := sqlite.OpenConn(":memory:", sqlite.OpenReadWrite)
	if err != nil {
		return Database[PluginConfig]{}, err
	}

	return Database[PluginConfig]{Conn: conn}, nil
}
