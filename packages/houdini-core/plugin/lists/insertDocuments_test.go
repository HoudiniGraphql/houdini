package lists_test

import (
	"context"
	"path"
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"
)

func TestInsertOperationDocuments(t *testing.T) {
	table := []struct {
		Name      string
		Documents []string
		Expected  []tests.ExpectedDocument
	}{
		{
			Name: "Operation fragments",
			Documents: []string{
				`
					query AllUsers {
						users @list(name: "All_Users") {
							firstName
						}
					}
				`,
			},
			Expected: []tests.ExpectedDocument{
				{
					Name: "AllUsers",
					Kind: "query",
					Selections: []tests.ExpectedSelection{
						{
							FieldName: "users",
							Alias:     tests.StrPtr("users"),
							Kind:      "field",
							Children: []tests.ExpectedSelection{
								{
									FieldName: "firstName",
									Alias:     tests.StrPtr("firstName"),
									Kind:      "field",
								},
							},
							Directives: []tests.ExpectedDirective{
								{
									Name: "list",
									Arguments: []tests.ExpectedDirectiveArgument{
										{
											Name: "name",
											Value: &tests.ExpectedArgumentValue{
												Kind: "String",
												Raw:  "All_Users",
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}

	schema := `
		type Query {
			user: User
			users: [User!]!
			legends: [Legend]
			ghost: Ghost
			entities: [Entity]
		}

		type User implements Entity{
			id: ID!
			firstName: String!
		}

		interface Entity {
			id: ID!
		}

		type Legend {
			name: String!
		}

		type Ghost {
			aka: String!
			name: String!
		}
	`

	projectConfig := plugins.ProjectConfig{
		ProjectRoot: "/project",
		SchemaPath:  "schema.graphql",
	}

	for _, row := range table {
		t.Run(row.Name, func(t *testing.T) {
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

			if err := tests.WriteHoudiniSchema(conn); err != nil {
				t.Fatalf("failed to create schema: %v", err)
			}

			// Use an in-memory file system.
			afero.WriteFile(plugin.Fs, path.Join("/project", "schema.graphql"), []byte(schema), 0644)

			// wire up the plugin
			err = plugin.Schema(context.Background())
			if err != nil {
				db.Put(conn)
				t.Fatalf("failed to load schema: %v", err)
			}

			// insert the raw document (assume id becomes 1).
			insertRaw, err := conn.Prepare("insert into raw_documents (content, filepath) values ($content, 'foo')")
			if err != nil {
				t.Fatalf("failed to prepare raw_documents insert: %v", err)
			}
			defer insertRaw.Finalize()
			for _, doc := range row.Documents {
				if err := db.ExecStatement(insertRaw, map[string]interface{}{"content": doc}); err != nil {
					t.Fatalf("failed to insert raw document: %v", err)
				}
			}

			// write the relevant config values
			insertConfig, err := conn.Prepare(`insert into config (default_keys, include, exclude, schema_path) values ($keys, '*', '*', '*')`)
			require.Nil(t, err)
			defer insertConfig.Finalize()
			err = db.ExecStatement(insertConfig, map[string]interface{}{"keys": `["id"]`})
			require.Nil(t, err)
			insertCustomKeys, err := conn.Prepare(`insert into type_configs (name, keys) values ($name, $keys)`)
			require.Nil(t, err)
			defer insertCustomKeys.Finalize()
			err = db.ExecStatement(insertCustomKeys, map[string]interface{}{"name": `Ghost`, "keys": `["aka", "name"]`})
			require.Nil(t, err)

			// load the documents into the database

			// wire up the plugin
			err = plugin.AfterExtract(context.Background())
			if err != nil {
				t.Fatalf("failed to load schema: %v", err)
			}

			// make sure we generated what we expected
			tests.ValidateExpectedDocuments(t, db, row.Expected)
		})
	}
}
