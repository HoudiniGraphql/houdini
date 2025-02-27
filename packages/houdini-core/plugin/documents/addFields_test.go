package documents_test

import (
	"context"
	"fmt"
	"path"
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"
)

func TestAddFields(t *testing.T) {
	table := []struct {
		Name     string
		Input    string
		Expected []tests.ExpectedDocument
	}{
		{
			Name: "Adds ids to selection sets of objects with them",
			Input: `
			query Friends {
				user {
					firstName
				}
			}
		`,
			Expected: []tests.ExpectedDocument{
				{
					Name: "Friends",
					Kind: "query",
					Selections: []tests.ExpectedSelection{
						{
							FieldName: "user",
							Alias:     tests.StrPtr("user"),
							Kind:      "field",
							Children: []tests.ExpectedSelection{
								{
									FieldName: "firstName",
									Alias:     tests.StrPtr("firstName"),
									Kind:      "field",
								},
								{
									FieldName: "__typename",
									Alias:     tests.StrPtr("__typename"),
									Kind:      "field",
								},
								{
									FieldName: "id",
									Alias:     tests.StrPtr("id"),
									Kind:      "field",
								},
							},
						},
					},
				},
			},
		},
		{
			Name: "doesn't add id if there isn't one",
			Input: `
			query Friends {
				legends {
					name
				}
			}
		`,
			Expected: []tests.ExpectedDocument{
				{
					Name: "Friends",
					Kind: "query",
					Selections: []tests.ExpectedSelection{
						{
							FieldName: "legends",
							Alias:     tests.StrPtr("legends"),
							Kind:      "field",
							Children: []tests.ExpectedSelection{
								{
									FieldName: "name",
									Alias:     tests.StrPtr("name"),
									Kind:      "field",
								},
								{
									FieldName: "__typename",
									Alias:     tests.StrPtr("__typename"),
									Kind:      "field",
								},
							},
						},
					},
				},
			},
		},
		{

			Name: "adds custom id fields to selection sets of objects with them",
			Input: `
			query Friends {
				ghost {
					name
				}
			}
		`,
			Expected: []tests.ExpectedDocument{
				{
					Name: "Friends",
					Kind: "query",
					Selections: []tests.ExpectedSelection{
						{
							FieldName: "ghost",
							Alias:     tests.StrPtr("ghost"),
							Kind:      "field",
							Children: []tests.ExpectedSelection{
								{
									FieldName: "name",
									Alias:     tests.StrPtr("name"),
									Kind:      "field",
								},
								{
									FieldName: "__typename",
									Alias:     tests.StrPtr("__typename"),
									Kind:      "field",
								},
								{
									FieldName: "aka",
									Alias:     tests.StrPtr("aka"),
									Kind:      "field",
								},
								{
									FieldName: "name",
									Alias:     tests.StrPtr("name"),
									Kind:      "field",
								},
							},
						},
					},
				},
			},
		},
		{
			Name: "adds id fields to inline fragments",
			Input: `
			query Friends {
				entities {
					... on User {
						name
					}
				}
			}
		`,
			Expected: []tests.ExpectedDocument{
				{
					Name: "Friends",
					Kind: "query",
					Selections: []tests.ExpectedSelection{
						{
							FieldName: "entities",
							Alias:     tests.StrPtr("entities"),
							Kind:      "field",
							Children: []tests.ExpectedSelection{
								{
									Kind:      "inline_fragment",
									FieldName: "User",
									Children: []tests.ExpectedSelection{
										{
											FieldName: "name",
											Alias:     tests.StrPtr("name"),
											Kind:      "field",
										},
										{
											FieldName: "id",
											Alias:     tests.StrPtr("id"),
											Kind:      "field",
										},
									},
								},
								{
									FieldName: "__typename",
									Alias:     tests.StrPtr("__typename"),
									Kind:      "field",
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
			legends: [Legend]
			ghost: Ghost
		}

		type User {
			id: ID!
			firstName: String!
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
		TypeConfig: map[string]plugins.TypeConfig{
			"Ghost": {
				Keys: []string{"aka", "name"},
			},
		},
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
			if err := db.ExecStatement(insertRaw, map[string]interface{}{"content": row.Input}); err != nil {
				t.Fatalf("failed to insert raw document: %v", err)
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

			errs := plugins.ErrorList{}
			documents.AddDocumentFields(context.Background(), db, &errs)
			if errs.Len() > 0 {
				t.Fatalf("failed to add fields: %v", errs.GetItems())
			}

			// make sure we generated what we expected
			tests.ValidateExpectedDocuments(t, db, row.Expected)

			fmt.Println("hello")
		})

	}
}
