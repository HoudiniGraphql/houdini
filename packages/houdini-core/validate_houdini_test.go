package main

import (
	"context"
	"fmt"
	"path"
	"testing"

	"code.houdinigraphql.com/plugins"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"
)

func TestValidate_Houdini(t *testing.T) {
	// the local schema we'll test against``
	schema := `
		type Query {
			user(name: String!) : User
			rootScalar: String
			ghost: Ghost
		}

		type Ghost {
			aka: String!
			name: String!
			age: Int!
		}

		type Subscription {
			newMessage: String
			anotherMessage: String
		}

		type Mutation {
			update(input: InputType, list: [InputType]): String
		}

		type User implements Node {
			id: ID!
			firstName: String
			lastName: String
		}

		type Cat {
			name: String!
		}

		input InputType {
			field: String
			list: [InputType]
		}

		interface Node {
			id: ID!
		}

		union Entity = User | Ghost

		directive @repeatable repeatable on FIELD
	`

	projectConfig := plugins.ProjectConfig{
		ProjectRoot: "/project",
		SchemaPath:  "schema.graphql",
	}

	var tests = []struct {
		Title     string
		Documents []string
		Pass      bool
	}{
		{
			Title: "No aliases for default keys",
			Pass:  false,
			Documents: []string{
				`query QueryA {
					user(name:"foo") {
						id: firstName
					}
				}`,
			},
		},
		{
			Title: "No aliases for configured keys",
			Pass:  false,
			Documents: []string{
				`query QueryA {
					ghost {
						aka: age
					}
				}`,
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Title, func(t *testing.T) {
			// // create and wire up a database we can test against
			db, err := plugins.NewPoolInMemory[PluginConfig]()
			if err != nil {
				t.Fatalf("failed to create in-memory db: %v", err)
			}
			defer db.Close()
			plugin := &HoudiniCore{
				fs: afero.NewMemMapFs(),
			}
			db.SetProjectConfig(projectConfig)
			plugin.SetDatabase(db)

			ctx := context.Background()

			conn, err := db.Take(ctx)
			require.Nil(t, err)
			// write the internal schema to the database
			err = executeSchema(conn)
			require.Nil(t, err)

			// Use an in-memory file system.
			afero.WriteFile(plugin.fs, path.Join("/project", "schema.graphql"), []byte(schema), 0644)

			// wire up the plugin
			err = plugin.Schema(ctx)
			require.Nil(t, err)

			// write the raw documents to the database
			insertRaw, err := conn.Prepare(`insert into raw_documents (content, filepath) values (?, 'foo')`)
			if err != nil {
				t.Fatalf("failed to prepare raw_documents insert: %v", err)
			}
			defer insertRaw.Finalize()
			for _, doc := range test.Documents {
				if err := db.ExecStatement(insertRaw, doc); err != nil {
					t.Fatalf("failed to insert raw document: %v", err)
				}
			}

			insertDefaultKeys, err := conn.Prepare(`insert into config (default_keys, include, exclude, schema_path) values (?, '*', '*', '*')`)
			if err != nil {
				t.Fatalf("failed to prepare raw_documents insert: %v", err)
			}
			err = db.ExecStatement(insertDefaultKeys, `["id"]`)
			if err != nil {
				t.Fatalf("failed insert default keys: %v", err)
			}

			insertTypeKeys, err := conn.Prepare(`insert into type_configs (name, keys) values ('Ghost', '["aka", "name"]')`)
			if err != nil {
				t.Fatalf("failed to prepare raw_documents insert: %v", err)
			}
			err = db.ExecStatement(insertTypeKeys)
			if err != nil {
				t.Fatalf("failed insert default keys: %v", err)
			}

			// load the raw documents into the database
			err = plugin.afterExtract_loadDocuments(ctx)
			require.Nil(t, err)
			// we're done with the database connection for now
			db.Put(conn)

			errs := &plugins.ErrorList{}
			plugin.afterExtract_componentFields(conn, errs)
			require.Equal(t, 0, errs.Len(), errs.GetItems())

			// run the validation
			err = plugin.Validate(ctx)
			if test.Pass {
				require.Nil(t, err)
			} else {
				require.NotNil(t, err)

				// make sure that the error has a validation kind
				if validationErr, ok := err.(*plugins.ErrorList); ok {
					// make sure we received a validation error
					err := validationErr.GetItems()[0]
					require.Equal(t, plugins.ErrorKindValidation, err.Kind, fmt.Sprintf("%s: %s", err.Message, err.Detail))
				} else {
					t.Fatal("did not receive error list")
				}
			}
		})
	}
}
