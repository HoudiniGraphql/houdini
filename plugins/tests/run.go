package tests

import (
	"context"
	"encoding/json"
	"path"
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"
)

type Table struct {
	Schema        string
	ProjectConfig plugins.ProjectConfig
	Tests         []Test
	PerformTest   func(t *testing.T, plugin *plugin.HoudiniCore, test Test)
}

type Test struct {
	Name          string
	Pass          bool
	Input         []string
	Expected      []ExpectedDocument
	ProjectConfig func(config *plugins.ProjectConfig)
}

func RunTable(t *testing.T, table Table) {
	// if the table doesn't have a custom performance, then we should execute all steps
	if table.PerformTest == nil {
		table.PerformTest = func(t *testing.T, plugin *plugin.HoudiniCore, test Test) {
			// wire up the plugin
			err := plugin.AfterExtract(context.Background())
			if err != nil {
				require.False(t, test.Pass)
				return
			}

			// run the validation step to discover lists
			err = plugin.Validate(context.Background())
			if err != nil {
				require.False(t, test.Pass, err.Error())
				return
			}

			// perform the necessary afterValidate steps
			err = plugin.AfterValidate(context.Background())
			if err != nil {
				require.False(t, test.Pass, err)
				return
			}

			require.True(t, test.Pass)

			// make sure we generated what we expected
			ValidateExpectedDocuments(t, plugin.DB, test.Expected)
		}
	}

	for _, test := range table.Tests {
		t.Run(test.Name, func(t *testing.T) {
			projectConfig := plugins.ProjectConfig{
				ProjectRoot: "/project",
				SchemaPath:  "schema.graphql",
				DefaultKeys: []string{"id"},
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
			db, err := plugins.NewPoolInMemory[plugin.PluginConfig]()
			if err != nil {
				t.Fatalf("failed to create in-memory db: %v", err)
			}
			defer db.Close()

			plugin := &plugin.HoudiniCore{
				Fs: afero.NewMemMapFs(),
			}

			db.SetProjectConfig(projectConfig)
			plugin.SetDatabase(db)

			conn, err := db.Take(context.Background())
			require.Nil(t, err)
			defer db.Put(conn)

			if err := WriteHoudiniSchema(conn); err != nil {
				t.Fatalf("failed to create schema: %v", err)
			}

			// Use an in-memory file system.
			afero.WriteFile(plugin.Fs, path.Join("/project", "schema.graphql"), []byte(table.Schema), 0644)

			// wire up the plugin
			err = plugin.Schema(context.Background())
			if err != nil {
				db.Put(conn)
				t.Fatalf("failed to execute schema: %v", err)
			}

			// insert the raw document (assume id becomes 1).
			insertRaw, err := conn.Prepare("insert into raw_documents (content, filepath) values ($content, 'foo')")
			if err != nil {
				t.Fatalf("failed to prepare raw_documents insert: %v", err)
			}
			defer insertRaw.Finalize()
			for _, doc := range test.Input {
				if err := db.ExecStatement(insertRaw, map[string]interface{}{"content": doc}); err != nil {
					t.Fatalf("failed to insert raw document: %v", err)
				}
			}

			// write the relevant config values
			insertConfig, err := conn.Prepare(`insert into config (default_keys, include, exclude, schema_path) values ($keys, '*', '*', '*')`)
			require.Nil(t, err)
			defer insertConfig.Finalize()
			defaultKeys, _ := json.Marshal(projectConfig.DefaultKeys)
			err = db.ExecStatement(insertConfig, map[string]interface{}{"keys": string(defaultKeys)})
			require.Nil(t, err)

			insertCustomKeys, err := conn.Prepare(`insert into type_configs (name, keys) values ($name, $keys)`)
			require.Nil(t, err)
			defer insertCustomKeys.Finalize()
			for typ, config := range projectConfig.TypeConfig {
				keys, _ := json.Marshal(config.Keys)
				err = db.ExecStatement(insertCustomKeys, map[string]interface{}{"name": typ, "keys": string(keys)})
				require.Nil(t, err)
			}

			insertScalarConfig, err := conn.Prepare(`insert into scalar_config (name, "type", input_types) values ($name, $type, $input_types)`)
			require.Nil(t, err)
			defer insertScalarConfig.Finalize()
			for typ, config := range projectConfig.Scalars {
				input_types, _ := json.Marshal(config.InputTypes)
				config.InputTypes = append(config.InputTypes, typ)
				err = db.ExecStatement(insertScalarConfig, map[string]interface{}{
					"name":        typ,
					"input_types": string(input_types),
					"type":        config.Type,
				})
				require.Nil(t, err)
			}

			table.PerformTest(t, plugin, test)
		})
	}
}
