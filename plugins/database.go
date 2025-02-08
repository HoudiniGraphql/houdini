package plugins

import (
	"zombiezen.com/go/sqlite"
)

type Database struct {
	_config *PluginConfig
	*sqlite.Conn
}

func ConnectDB() (Database, error) {
	conn, err := sqlite.OpenConn(databasePath, sqlite.OpenReadWrite)
	if err != nil {
		return Database{}, err
	}

	return Database{Conn: conn}, nil
}

func InMemoryDB() (Database, error) {
	conn, err := sqlite.OpenConn(":memory:", sqlite.OpenReadWrite)
	if err != nil {
		return Database{}, err
	}

	return Database{Conn: conn}, nil
}
