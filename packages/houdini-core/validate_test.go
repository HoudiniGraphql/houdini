package main

import (
	"context"
	"path"
	"testing"

	"code.houdinigraphql.com/plugins"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"
)

func TestValidate(t *testing.T) {
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
		}

		type Subscription {
			newMessage: String
			anotherMessage: String
		}

		type Mutation {
			update(input: InputType!): String
		}

		type User {
			firstName: String
		}

		type Cat {
			name: String!
		}

		input InputType {
			field: String
			field: String
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

	var tests = []struct {
		Title     string
		Documents []string
		Pass      bool
	}{
		/*
		 * These tests validate the default validation rules that are specified by the spec
		 */
		{
			Title: "Subscription with more than one root field.",
			Pass:  false,
			Documents: []string{
				`subscription TestSub {
					newMessage
					anotherMessage
				}`,
			},
		},
		{
			Title: "Duplicate operation names",
			Pass:  false,
			Documents: []string{
				`fragment Test on User
					firstName
				}`,
				`query Test {
					user(name:"foo") {
						firstName
					}
				}`,
			},
		},
		{
			Title: "Fragment references an unknown type.",
			Pass:  false,
			Documents: []string{
				`fragment invalidFragment on NonExistentType {
					field
				}`,
			},
		},
		{
			Title: "Fragment defined on a scalar type.",
			Pass:  false,
			Documents: []string{
				`fragment scalarFragment on String {
					length
				}`,
			},
		},
		{
			Title: "Using an output type (object type) as a variable type.",
			Pass:  false,
			Documents: []string{
				`query Test($name: Query) {
					user(arg: $name)
				}`,
			},
		},
		{
			Title: "Scalar field used with a sub-selection.",
			Pass:  false,
			Documents: []string{
				`query Test {
					rootScalar {
						first
					}
				}`,
			},
		},
		{
			Title: "Querying a field that doesn't exist on the type.",
			Pass:  false,
			Documents: []string{
				`query Test{
					user(name:"foo") {
						nonExistentField
					}
				}`,
			},
		},
		{
			Title: "Spreading a fragment on an incompatible type.",
			Pass:  false,
			Documents: []string{
				`fragment frag on Cat {
					name
				}`,
				`query {
					user(name:"foo") {
						...frag
					}
				}`,
			},
		},
		{
			Title: "Fragments that reference each other in a cycle.",
			Pass:  false,
			Documents: []string{
				`query Test{
					user(name:"foo") {
						...A
					}
				}`,
				`fragment A on User {
					firstName
					...B
				}`,
				`fragment B on User {
					firstName
					...A
				}`,
			},
		},
		{
			Title: "Defining the same variable twice.",
			Pass:  false,
			Documents: []string{
				`query Test($a: String, $a: String) {
					user(name: "foo") {
						firstName
					}
				}`,
			},
		},
		{
			Title: "Using an undefined variable.",
			Pass:  false,
			Documents: []string{
				`query Test {
					user(name: $undefined) {
						firstName
					}
				}`,
			},
		},
		{
			Title: "Variable defined but never used.",
			Pass:  false,
			Documents: []string{
				`query Test($unused: String) {
					user(name:"foo") {
						firstName
					}
				}`,
			},
		},
		{
			Title: "Using an unknown directive.",
			Pass:  false,
			Documents: []string{
				`query Test{
					user(name:"foo" @unknown {
						firstName
					}
				}`,
			},
		},
		{
			Title: "Repeating the same non-repeatable directive on a field.",
			Pass:  false,
			Documents: []string{
				`query Test{
					user(name:"foo" @include(if: true) @include(if: false) {
						firstName
					}
				}`,
			},
		},
		{
			Title: "Repeating a repeatable directive on a field.",
			Pass:  true,
			Documents: []string{
				`query Test{
					user(name:"foo") @repeatable @repeatable {
						firstName
					}
				}`,
			},
		},
		{
			Title: "Duplicating an argument in a field.",
			Pass:  false,
			Documents: []string{
				`query Test{
					user(name: "value", name: "another")
				}`,
			},
		},
		{
			Title: "Providing an argument value of the wrong type.",
			Pass:  false,
			Documents: []string{
				`query Test{
					user(name: 1) {
						firstName
					}
				}`,
			},
		},
		{
			Title: "Missing a required argument.",
			Pass:  false,
			Documents: []string{
				`query Test {
					user {
						firstName
					}
				}`,
			},
		},
		{
			Title: "Threading a required argument through",
			Pass:  true,
			Documents: []string{
				`query Test($name: String!) {
					user(name: $name) {
						firstName
					}
				}`,
			},
		},
		{
			Title: "Variable used in a position with an incompatible type.",
			Pass:  false,
			Documents: []string{
				`query Test($var: String!) {
					user(name: $var) {
						firstName
					}
				}`,
			},
		},
		{
			Title: "Non-required variables passed to required arg",
			Pass:  false,
			Documents: []string{
				`query Test($var: String) {
					user(name: $var) {
						firstName
					}
				}`,
			},
		},
		{
			Title: "Conflicting field selections that cannot be merged.",
			Pass:  false,
			Documents: []string{
				`query Test{
					user(name:"foo") {
						name: firstName
						name: lastName
					}
				}`,
			},
		},
		{
			Title: "Duplicate keys in an input object.",
			Pass:  false,
			Documents: []string{
				`mutation Test($input: InputType!) {
					update(input: { field: "value", field: "another value" })
				}`,
			},
		},
		/*
		 * Houdini-specific validation rules
		 */
		{
			Title: "No 'id' aliases",
			Pass:  false,
			Documents: []string{
				`query QueryA {
					user {
						id: firstName
					}
				}`,
			},
		},
		{
			Title: "No aliases for keys",
			Pass:  false,
			Documents: []string{
				`query QueryA {
					user {
						id: firstName
					}
				}`,
				`query QueryB {
					user {
						id: firstName
					}
				}`,
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Title, func(t *testing.T) {
			// create and wire up a database we can test against
			db, err := plugins.NewPoolInMemory[PluginConfig]()
			if err != nil {
				t.Fatalf("failed to create in-memory db: %v", err)
			}
			defer db.Close()
			plugin := &HoudiniCore{
				fs: afero.NewMemMapFs(),
			}
			plugin.SetDatabase(db)
			db.SetProjectConfig(projectConfig)

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
			insertRaw, err := conn.Prepare("insert into raw_documents (content, filepath) values (?, 'foo')")
			if err != nil {
				t.Fatalf("failed to prepare raw_documents insert: %v", err)
			}
			defer insertRaw.Finalize()
			for _, doc := range test.Documents {
				if err := db.ExecStatement(insertRaw, doc); err != nil {
					t.Fatalf("failed to insert raw document: %v", err)
				}
			}
			db.Put(conn)

			// run the validation
			err = plugin.Validate(ctx)
			if test.Pass {
				require.Nil(t, err)
			} else {
				require.NotNil(t, err)
			}
		})
	}
}
