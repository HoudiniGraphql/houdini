package tests

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins"
)

type Table[PluginConfig any, PluginType plugins.HoudiniPlugin[PluginConfig]] struct {
	Schema        string
	ProjectConfig plugins.ProjectConfig
	Tests         []Test[PluginConfig]
	Plugin        Plugin[PluginConfig]
	SetupTest     func(t *testing.T, plugin PluginType, test Test[PluginConfig])
	PerformTest   func(t *testing.T, plugin PluginType, test Test[PluginConfig])
	VerifyTest    func(t *testing.T, plugin PluginType, test Test[PluginConfig])
}

type Plugin[PluginConfig any] struct {
	Name                 string
	Hooks                []string
	IncludeRuntime       string
	IncludeStaticRuntime string
	Config               PluginConfig
}

type Test[PluginConfig any] struct {
	Name          string
	Pass          bool
	Input         []string
	Expected      []ExpectedDocument
	Extra         map[string]any
	ProjectConfig func(config *plugins.ProjectConfig)
}

func RunTable[PluginConfig any, PluginType plugins.HoudiniPlugin[PluginConfig]](
	t *testing.T,
	table Table[PluginConfig, PluginType],
) {
	if table.VerifyTest == nil {
		table.VerifyTest = func(t *testing.T, plugin PluginType, test Test[PluginConfig]) {
			// make sure we generated what we expected
			if len(test.Expected) > 0 {
				ValidateExpectedDocuments(t, plugin.Database(), test.Expected)
			}
		}
	}

	// if the table doesn't have a custom performance, then we should execute all steps
	if table.PerformTest == nil {
		table.PerformTest = func(t *testing.T, plugin PluginType, test Test[PluginConfig]) {
			// wire up the plugin
			// Skip AfterExtract for HoudiniCore since it was already called in setup
			if after, ok := any(plugin).(plugins.AfterExtract); ok {
				// Check if this is HoudiniCore by checking the plugin name
				if plugin.Name() != "houdini-core" {
					err := after.AfterExtract(context.Background())
					if err != nil {
						require.False(t, test.Pass, err.Error())
						return
					}
				}
			}

			// run the validation step to discover lists
			if validate, ok := any(plugin).(plugins.Validate); ok {
				err := validate.Validate(context.Background())
				if err != nil {
					require.False(t, test.Pass, err.Error())
					return
				}
			}

			// perform the necessary afterValidate steps
			if after, ok := any(plugin).(plugins.AfterValidate); ok {
				err := after.AfterValidate(context.Background())
				if err != nil {
					require.False(t, test.Pass, err)
					return
				}
			}

			// generate the artifacts
			if generate, ok := any(plugin).(plugins.GenerateDocuments); ok {
				_, err := generate.GenerateDocuments(context.Background())
				if err != nil {
					require.False(t, test.Pass, err.Error())
					return
				}
			}

			// as well as the runtime
			if runtime, ok := any(plugin).(plugins.GenerateRuntime); ok {
				_, err := runtime.GenerateRuntime(context.Background())
				if err != nil {
					require.False(t, test.Pass, err.Error())
					return
				}
			}

			require.True(t, test.Pass)

			table.VerifyTest(t, plugin, test)
		}
	}

	for _, test := range table.Tests {
		t.Run(test.Name, func(t *testing.T) {
			projectConfig := plugins.ProjectConfig{
				ProjectRoot:          "/project",
				SchemaPath:           "schema.graphql",
				DefaultKeys:          []string{"id"},
				TypeConfig:           make(map[string]plugins.TypeConfig),
				DefaultCachePolicy:   "CacheOrNetwork",
				DefaultPartial:       false,
				DefaultPaginateMode:  "Infinite",
				RuntimeDir:           ".houdini",
				PersistedQueriesPath: "persisted_queries.json",
			}

			if table.ProjectConfig.TypeConfig != nil {
				projectConfig.TypeConfig = table.ProjectConfig.TypeConfig
			}

			if table.ProjectConfig.RuntimeScalars != nil {
				projectConfig.RuntimeScalars = table.ProjectConfig.RuntimeScalars
			}

			if table.ProjectConfig.Scalars != nil {
				projectConfig.Scalars = table.ProjectConfig.Scalars
			}

			if test.ProjectConfig != nil {
				test.ProjectConfig(&projectConfig)
			}

			// create an in-memory db.
			db, err := plugins.NewTestPool[config.PluginConfig]()
			if err != nil {
				t.Fatalf("failed to create in-memory db: %v", err)
			}
			defer db.Close()

			fs := afero.NewMemMapFs()
			// we need a core plugin to set up the system
			core := &plugin.HoudiniCore{}
			core.SetFilesystem(fs)

			db.SetProjectConfig(projectConfig)
			core.SetDatabase(db)

			conn, err := db.Take(context.Background())
			require.Nil(t, err)
			defer db.Put(conn)

			if err := WriteDatabaseSchema(conn); err != nil {
				t.Fatalf("failed to create schema: %v", err)
			}

			// before we run through the tests we should register tthe plugin if it exists
			if table.Plugin.Name != "" {
				insertPlugin, err := conn.Prepare(`
					INSERT INTO "plugins" 
									("name", "port", "hooks", "plugin_order", "include_runtime", "include_static_runtime", "config", "config_module", "client_plugins") 
								VALUES
									($name, '0', $hooks, 'core', $include_runtime, $include_static_runtime, $config, NULL, NULL)
				`)
				require.NoError(t, err)

				// stringify any registered hooks
				marshaled, err := json.Marshal(table.Plugin.Hooks)
				require.NoError(t, err)
				hooks := string(marshaled)

				// stringfy the plugin config
				marshaled, err = json.Marshal(table.Plugin.Config)
				require.NoError(t, err)
				config := string(marshaled)

				// execute the insert
				err = db.ExecStatement(insertPlugin, map[string]any{
					"name":                   table.Plugin.Name,
					"hooks":                  hooks,
					"config":                 config,
					"include_runtime":        table.Plugin.IncludeRuntime,
					"include_static_runtime": table.Plugin.IncludeStaticRuntime,
				})
				require.NoError(t, err)
			}

			// Use an in-memory file system.
			afero.WriteFile(
				core.Fs,
				filepath.Join("/project", "schema.graphql"),
				[]byte(table.Schema),
				0644,
			)

			// wire up the plugin
			err = core.Schema(context.Background())
			if err != nil {
				db.Put(conn)
				t.Fatalf("failed to execute schema: %v", err)
			}

			// insert the raw document (assume id becomes 1).
			insertRaw, err := conn.Prepare(
				"insert into raw_documents (content, filepath) values ($content, $filepath)",
			)
			if err != nil {
				t.Fatalf("failed to prepare raw_documents insert: %v", err)
			}
			defer insertRaw.Finalize()
			for i, doc := range test.Input {
				if err := db.ExecStatement(insertRaw, map[string]any{"content": doc, "filepath": fmt.Sprintf("file-%v", i)}); err != nil {
					t.Fatalf("failed to insert raw document: %v", err)
				}
			}

			// write the relevant config values
			insertConfig, err := conn.Prepare(
				`insert into config (default_keys, include, exclude, schema_path, default_paginate_mode) values ($keys, $include, $exclude, $schema_path, $paginate_mode)`,
			)
			require.Nil(t, err)
			defer insertConfig.Finalize()
			defaultKeys, _ := json.Marshal(projectConfig.DefaultKeys)
			includeJSON, _ := json.Marshal([]string{"**/*"})
			excludeJSON, _ := json.Marshal([]string{})
			err = db.ExecStatement(insertConfig, map[string]any{
				"keys":          string(defaultKeys),
				"include":       string(includeJSON),
				"exclude":       string(excludeJSON),
				"schema_path":   "*",
				"paginate_mode": "Infinite",
			})
			require.Nil(t, err)

			insertCustomKeys, err := conn.Prepare(
				`insert into type_configs (name, keys, resolve_query) values ($name, $keys, $resolve_query)`,
			)
			require.Nil(t, err)
			defer insertCustomKeys.Finalize()

			for typ, config := range projectConfig.TypeConfig {
				var resolveQuery any
				if config.ResolveQuery != "" {
					resolveQuery = config.ResolveQuery
				}
				keys, _ := json.Marshal(config.Keys)
				err = db.ExecStatement(
					insertCustomKeys,
					map[string]any{
						"name":          typ,
						"keys":          string(keys),
						"resolve_query": resolveQuery,
					},
				)
				require.Nil(t, err)
			}

			insertRuntimeScalarConfig, err := conn.Prepare(`
        insert into runtime_scalar_definitions (name, "type") values ($name, $type)
      `)
			require.Nil(t, err)
			defer insertRuntimeScalarConfig.Finalize()
			for key, value := range projectConfig.RuntimeScalars {
				err = db.ExecStatement(insertRuntimeScalarConfig, map[string]any{
					"name": key,
					"type": value,
				})
				require.Nil(t, err)
			}

			insertScalarConfig, err := conn.Prepare(
				`insert into scalar_config (name, "type", input_types) values ($name, $type, $input_types)`,
			)
			require.Nil(t, err)
			defer insertScalarConfig.Finalize()
			for typ, config := range projectConfig.Scalars {
				input_types, _ := json.Marshal(config.InputTypes)
				config.InputTypes = append(config.InputTypes, typ)
				err = db.ExecStatement(insertScalarConfig, map[string]any{
					"name":        typ,
					"input_types": string(input_types),
					"type":        config.Type,
				})
				require.Nil(t, err)
			}

			// run the extraction step to populate the documents table
			err = core.ExtractDocuments(context.Background(), plugins.ExtractDocumentsInput{})
			require.NoError(t, err)

			// parse the raw documents into the documents table
			// If the test expects to fail, parsing errors are acceptable
			err = core.AfterExtract(context.Background())
			if err != nil && test.Pass {
				// Only fail if the test was supposed to pass
				require.NoError(t, err)
			}

			// run the core plugin's validation step to populate discovered_lists table
			// This is essential for pagination detection and other list operations
			err = core.Validate(context.Background())
			if err != nil && test.Pass {
				// Only fail if the test was supposed to pass
				require.NoError(t, err)
			}

			// and now we need to instantiate the specific plugin we're using
			var plugin PluginType

			// Handle pointer types by creating a new instance
			pluginType := reflect.TypeOf(plugin)
			if pluginType.Kind() == reflect.Ptr {
				// Create a new instance of the underlying type
				plugin = reflect.New(pluginType.Elem()).Interface().(PluginType)
			}

			pluginDB := plugins.DatabasePool[PluginConfig]{
				Pool:       db.Pool,
				PluginName: plugin.Name(),
				Test:       true,
			}
			pluginDB.SetProjectConfig(projectConfig)
			plugin.SetDatabase(pluginDB)
			plugin.SetFilesystem(fs)

			table.PerformTest(t, plugin, test)
		})
	}
}
