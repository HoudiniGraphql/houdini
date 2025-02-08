package plugins

import (
	"encoding/json"

	"zombiezen.com/go/sqlite"
	"zombiezen.com/go/sqlite/sqlitex"
)

type ProjectConfig struct {
	Include                         []string
	Exclude                         []string
	DefinitionsPath                 string
	CacheBufferSize                 int
	DefaultCachePolicy              string
	DefaultPartial                  bool
	DefaultLifetime                 int
	DefaultListPosition             string
	DefaultListTarget               string
	DefaultPaginateMode             string
	SuppressPaginationDeduplication bool
	LogLevel                        string
	DefaultFragmentMasking          bool
	DefaultKeys                     []string
	PersistedQueriesPath            string
	ProjectRoot                     string
	RuntimeDir                      string
}

func (db Database) ProjectConfig() (ProjectConfig, error) {
	// if we've already loaded the config use it
	if db._config != nil {
		return *db._config, nil
	}

	// otherwise load it from the database
	err := db.ReloadProjectConfig()
	if err != nil {
		return ProjectConfig{}, err
	}

	// this has been loaded by now
	return *db._config, nil
}

func (db *Database) ReloadProjectConfig() error {
	// build up a config object
	config := ProjectConfig{}

	// load the config from the database
	err := sqlitex.Execute(db.Conn, `SELECT
		include,
		exclude,
		definitions_path,
		cache_buffer_size,
		default_cache_policy,
		default_partial,
		default_lifetime,
		default_list_position,
		default_list_target,
		default_paginate_mode,
		suppress_pagination_deduplication,
		log_level,
		default_fragment_masking,
		default_keys,
		persisted_queries_path,
		project_root,
		runtime_dir
	FROM config`, &sqlitex.ExecOptions{
		ResultFunc: func(stmt *sqlite.Stmt) error {
			err := json.Unmarshal([]byte(stmt.ColumnText(0)), &config.Include)
			if err != nil {
				return err
			}
			err = json.Unmarshal([]byte(stmt.ColumnText(1)), &config.Exclude)
			if err != nil {
				return err
			}

			config.DefinitionsPath = stmt.ColumnText(2)
			config.CacheBufferSize = stmt.ColumnInt(3)
			config.DefaultCachePolicy = stmt.ColumnText(4)
			config.DefaultPartial = stmt.ColumnInt(5) == 1
			config.DefaultLifetime = stmt.ColumnInt(6)
			config.DefaultListPosition = stmt.ColumnText(7)
			config.DefaultListTarget = stmt.ColumnText(8)
			config.DefaultPaginateMode = stmt.ColumnText(9)
			config.SuppressPaginationDeduplication = stmt.ColumnInt(10) == 1
			config.LogLevel = stmt.ColumnText(11)
			config.DefaultFragmentMasking = stmt.ColumnInt(12) == 1
			err = json.Unmarshal([]byte(stmt.ColumnText(13)), &config.DefaultKeys)
			if err != nil {
				return err
			}
			config.PersistedQueriesPath = stmt.ColumnText(14)
			config.ProjectRoot = stmt.ColumnText(15)
			config.RuntimeDir = stmt.ColumnText(16)

			// nothing went wrong
			return nil
		},
	})
	if err != nil {
		return err
	}

	// store the config we loaded
	db._config = &config

	return nil
}
