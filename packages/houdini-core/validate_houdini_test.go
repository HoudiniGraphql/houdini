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
			user : User
			users: [User!]!
			nodes(ids: [ID!]!): [Node!]!
			entitiesByCursor(first: Int, after: String, last: Int, before: String): EntityConnection!
			node(id: ID!): Node
			ghost: Ghost!
		}

		type Mutation {
			addFriend: AddFriendOutput!
			deleteUser(id: String!): DeleteUserOutput!
			updateGhost: Ghost!
		}

		type User implements Node {
			id: ID!
			parent: User
			firstName: String!
			friends: [User!]!
			friendsConnection(first: Int, after: String, last: Int, before: String): UserConnection!
			friendsByOffset(offset: Int, limit: Int): [User!]!
			believers(first: Int, after: String, last: Int, before: String): UserConnection!
		}

		type Ghost implements Entity{
			aka: String!
			name: String!
			believers(first: Int, after: String, last: Int, before: String): UserConnection!
		}

		type Legend implements Entity{
			aka: String!
			name: String!
			believers(first: Int, after: String, last: Int, before: String): UserConnection!
		}

		type AddFriendOutput {
			friend: User!
		}

		type DeleteUserOutput {
			userID: ID!
		}

		type UserConnection {
			edges: [UserEdge!]!
			pageInfo: PageInfo!
		}

		type UserEdge {
			cursor: String!
			node: User!
		}

		type PageInfo {
			hasNextPage: Boolean!
			hasPreviousPage: Boolean!
			startCursor: String
			endCursor: String
		}

		interface Node {
			id: ID!
		}

		interface Entity {
			name: String!
			aka: String!
		}

		type EntityConnection {
			edges: [EntityEdge!]!
			pageInfo: PageInfo!
		}

		type EntityEdge {
			cursor: String!
			node: User!
		}

	`

	projectConfig := plugins.ProjectConfig{
		ProjectRoot: "/project",
		SchemaPath:  "schema.graphql",
		RuntimeScalars: map[string]string{
			"ViewerIDFromSession": "ID",
		},
	}

	var tests = []struct {
		Title     string
		Documents []string
		Pass      bool
		Config    func(config *plugins.ProjectConfig)
	}{
		{
			Title: "No aliases for default keys",
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
		{
			Title: "allows documents spread across multiple sources",
			Pass:  true,
			Documents: []string{
				`query QueryA {
					user {
						...FragmentA
					}
				}`,
				`query QueryB {
					user {
						...FragmentA
					}
				}`,
				`fragment FragmentA on User {
					firstName
				}`,
			},
		},
		{
			Title: "Valid arguments on directives",
			Pass:  true,
			Documents: []string{
				`query TestQuery {
						user {
							friends @list(name: "Friends") {
								id
							}
						}
					}`,
			},
		},
		{
			Title: "Invalid arguments on directives",
			Pass:  false,
			Documents: []string{
				`query TestQuery {
						user {
							friends @list(foo: "Friends") {
								id
							}
						}
					}`,
			},
		},
		{
			Title: "@list on query",
			Pass:  true,
			Documents: []string{
				`query TestQuery {
					user {
						friends @list(name: "Friends") {
							id
						}
					}
				}`,
				`mutation MutationM {
					addFriend {
						friend {
							...Friends_insert
						}
					}
				}`,
			},
		},
		{
			Title: "no @parentID @allLists on _insert, but defaultListTarget",
			Pass:  true,
			Documents: []string{
				`query TestQuery {
					user {
						friends {
							friends @list(name: "Friends") {
								id
							}
						}
					}
				}`,
				`mutation MutationM1 {
					addFriend {
						friend {
							...Friends_insert
						}
					}
				}`,
			},
			Config: func(config *plugins.ProjectConfig) {
				config.DefaultListTarget = "all"
			},
		},
		{
			Title: "@parentID @allLists on _insert",
			Pass:  false,
			Documents: []string{
				`query TestQuery {
					user {
						friends {
							friends @list(name: "Friends") {
								id
							}
						}
					}
				}`,
				`mutation MutationM1 {
					addFriend {
						...Friends_insert @parentID(value: "1") @allLists
					}
				}`,
			},
		},
		{
			Title: "@mask_enable @mask_disable on fragment",
			Pass:  false,
			Documents: []string{
				`fragment FooA on Query {
					users(stringValue: $name) { id }
				}`,
				`query TestQuery {
					...FooA @mask_enable @mask_disable
				}`,
			},
		},
		{
			Title: "@list name must be unique",
			Pass:  false,
			Documents: []string{
				`
                query TestQuery1 {
					user {
						friends {
							friends @list(name: "Friends") {
								id
							}
						}
					}
                }
            	`,
				`
				query TestQuery2 {
					user {
						friends {
							friends @list(name: "Friends") {
								id
							}
						}
					}
				}
            	`,
			},
		},
		{
			Title: "@list with parentID as variable on query",
			Pass:  true,
			Documents: []string{
				`query TestQuery {
					user {
						friends {
							friends @list(name: "Friends") {
								id
							}
						}
					}
        		}`,
				`mutation MutationM1($parentID: ID!) {
					addFriend {
						...Friends_insert @prepend @parentID(value: $parentID)
					}
				}`,
			},
		},
		{
			Title: "@list without parentID on fragment",
			Pass:  false,
			Documents: []string{
				`fragment FragmentA on User {
					friends @list(name: "Friends") {
						firstName
					}
                }`,
				`mutation Mutation1 {
					addFriend {
						...Friends_insert
					}
                }`,
			},
		},
		{
			Title: "@list prepend on query no id",
			Pass:  false,
			Documents: []string{
				`
					query UserFriends {
						user {
							friends {
								friends @list(name: "Friends") {
									id
								}
							}
						}
					}
				`,
				`
					mutation Mutation1 {
						addFriend {
							...Friends_insert @prepend
						}
					}
            	`,
			},
		},
		{
			Title: "@list append on query no id",
			Pass:  false,
			Documents: []string{
				`
					query UserFriends {
						user {
							friends {
								friends @list(name: "Friends") {
									id
								}
							}
						}
					}
            	`,
				`
					mutation Mutation1 {
						addFriend {
							...Friends_insert @append
						}
					}
            	`,
			},
		},
		{
			Title: "@list no directive on query",
			Pass:  false,
			Documents: []string{
				`
					query UserFriends {
						user {
							friends {
								friends @list(name: "Friends") {
									id
								}
							}
						}
					}
            	`,
				`
					mutation Mutation1 {
						addFriend {
							...Friends_insert
						}
					}
            	`,
			},
		},
		{
			Title: "Unknown fragments",
			Pass:  false,
			Documents: []string{
				`
					query Foo {
						user {
							...UserFragment
						}
					}
				`,
			},
		},
		{
			Title: "unknown list fragments",
			Pass:  false,
			Documents: []string{
				`
					mutation Foo {
						addFriend {
							...UserFragment_insert @parentID(value: "2")
						}
					}
				`,
			},
		},
		{
			Title: "known list directives",
			Pass:  true,
			Documents: []string{
				`
				query UserFriends {
					user {
						friends @list(name: "Friends") {
							id
						}
					}
				}
				`,
				`
				mutation Bar {
					deleteUser(id: "2") {
						userID @User_delete
					}
				}
				`,
			},
		},
		{
			Title: "known connection directives",
			Pass:  true,
			Documents: []string{
				`
				query UserFriends {
					user {
						friendsConnection @list(name: "Friends") {
							edges {
								node {
									id
								}
							}
						}
					}
				}
				`,
				`
				mutation Bar {
					deleteUser(id: "2") {
						userID @User_delete
					}
				}
				`,
			},
		},
		{
			Title: "unknown list directives",
			Pass:  false,
			Documents: []string{
				`
					mutation Foo {
						deleteUser(id: "2") {
							userID @Foo_delete
						}
					}
				`,
			},
		},
		{
			Title: "missing fragment arguments",
			Pass:  false,
			Documents: []string{
				`
					fragment Foo on Query @arguments(name: { type: "String!" }) {
						users(stringValue: $name) { id }
					}
				`,
				`
					query Query1 {
						...Foo
					}
				`,
			},
		},
		{
			Title: "invalid argument",
			Pass:  false,
			Documents: []string{
				`
					fragment Foo on Query @arguments(name: { type: "String" }) {
						users(stringValue: $name) { id }
					}
				`,
				`
					query Query1 {
						...Foo @with(bar: "blah", name: "bar")
					}
				`,
			},
		},
		{
			Title: "unused fragment arguments",
			Pass:  false,
			Documents: []string{
				`
					fragment Foo1 on Query @arguments(name: { type: "String!" }) {
						users(stringValue: "hello") { id }
					}
				`,
			},
		},
		{
			Title: "applied fragment arguments",
			Pass:  false,
			Documents: []string{
				`
					fragment Foo on Query @arguments(name: { type: "String" }) {
						users(stringValue: $name) { id }
					}
				`,
				`
					query Query2 {
						...Foo @with(name: true)
					}
				`,
			},
		},
		{
			Title: "fragment argument definition default",
			Pass:  false,
			Documents: []string{
				`
					fragment FooA on Query @arguments(name: { type: "String", default: true}) {
						users(stringValue: $name) { id }
					}
				`,
			},
		},
		{
			Title: "@paginate offset happy path",
			Pass:  true,
			Documents: []string{
				`
					fragment UserPaginatedA on User {
						friendsByOffset(limit: 10) @paginate {
							id
						}
					}
				`,
			},
		},
		{
			Title: "list of strings passed to fragment argument type argument (woof)",
			Pass:  true,
			Documents: []string{
				`
					fragment NodePaginatedA on Query @arguments(
						ids: { type: "[String]" }
					) {
						nodes(ids: $ids) {
							id
						}
					}
				`,
				`
					query QueryWithFragmentA {
						...Fragment @with(ids: ["A"])
					}
				`,
			},
		},
		{
			Title: "must pass list to list fragment arguments",
			Pass:  false,
			Documents: []string{
				`
					fragment Fragment on Query @arguments(
						ids: { type: "[String]" }
					) {
						nodes(ids: $ids) {
							id
						}
					}
				`,
				`
					query QueryWithFragmentA {
						...Fragment @with(ids: "A")
					}
				`,
			},
		},
		{
			Title: "@paginate cursor happy path",
			Pass:  true,
			Documents: []string{
				`
					fragment UserPaginatedA on User {
						friendsConnection(first: 10) @paginate {
							edges {
								node {
									id
								}
							}
						}
					}
				`,
			},
		},
		{
			Title: "cursor pagination requires first",
			Pass:  false,
			Documents: []string{
				`
					fragment UserCursorPaginatedA on User {
						friendsConnection @paginate {
							edges {
								node {
									id
								}
							}
						}
					}
				`,
			},
		},
		{
			Title: "@paginate cursor can't go both ways",
			Pass:  false,
			Documents: []string{
				`
					fragment UserPaginatedA on User {
						friendsConnection(first: 10, last: 10) @paginate(mode: Infinite) {
							edges {
								node {
									id
								}
							}
						}
					}
				`,
			},
		},
		{
			Title: "@paginate can show up in a document with required args",
			Pass:  true,
			Documents: []string{
				`
					fragment UserPaginatedA on User @arguments(foo: { type: "String!" }) {
						friendsConnection(first: 10, after: $foo) @paginate {
							edges {
								node {
									id
								}
							}
						}
					}
				`,
			},
		},
		{
			Title: "offset pagination requires limit",
			Pass:  false,
			Documents: []string{
				`
					fragment UserPaginatedA on User {
						friendsByOffset @paginate {
							id
						}
					}
				`,
			},
		},
		{
			Title: "multiple @paginate",
			Pass:  false,
			Documents: []string{
				`
					fragment UserPaginatedA on User {
						friendsByOffset(limit: 10) @paginate {
							id
						}
						friendsConnection(first: 10) @paginate {
							edges {
								node {
									id
								}
							}
						}
					}
				`,
			},
		},
		{
			Title: "@paginate can fall on an interface if every constituent has a custom key",
			Pass:  true,
			// name needs to be passed to validate the id field
			Documents: []string{
				`
					query QueryA {
						entitiesByCursor(first: 10) @paginate(name: "GhostA") {
							edges {
								node {
									... on Ghost {
										name
									}
								}
							}
						}
					}
				`,
			},
		},
		{
			Title: "@paginate can't fall under lists",
			Pass:  false,
			Documents: []string{
				`
					fragment UserPaginatedA on User {
						friends {
							friendsByOffset(limit: 10) @paginate {
								id
							}
						}
					}
				`,
			},
		},
		{
			Title: "@paginate can't be in a fragment containing a non Node or configured type",
			Pass:  false,
			Documents: []string{
				`
					fragment UserPaginatedA on Legend {
						believers (first: 10) @paginate {
							edges {
								node {
									name
								}
							}
						}
					}
				`,
			},
		},
		{
			Title: "@paginate can fall on a fragment of a Node",
			Pass:  true,
			Documents: []string{
				`
					fragment UserPaginatedA on User {
						friendsConnection (first: 10) @paginate {
							edges {
								node {
									firstName
								}
							}
						}
					}
				`,
			},
		},
		{
			Title: "@paginate must fall on something with configured lookups",
			Pass:  false,
			Documents: []string{
				`
					fragment UserPaginatedA on Ghost {
						believers (first: 10) @paginate {
							edges {
								node {
									firstName
								}
							}
						}
					}
				`,
			},
		},
		{
			Title: "@paginate can fall on a fragment of a configured type",
			Pass:  true,
			Documents: []string{
				`
					fragment UserPaginated on User {
						friendsConnection (first: 10) @paginate {
							edges {
								node {
									firstName
								}
							}
						}
					}
				`,
			},
		},
		{
			Title: "unreachable @loading",
			Pass:  false,
			Documents: []string{
				`
					fragment LoadingDirectiveA on User {
						friendsConnection {
							edges {
								node @loading {
									firstName
								}
							}
						}
					}
				`,
			},
		},
		{
			Title: "floating @loading with global flag",
			Pass:  true,
			Documents: []string{
				`
					fragment LoadingDirectiveA on User @loading {
						friendsConnection {
							edges {
								node @loading {
									firstName
								}
							}
						}
					}
				`,
			},
		},
		{
			Title: "@required may not be used on query arguments",
			Pass:  false,
			Documents: []string{
				`
					query QueryA($id: ID! @required) {
						node(id: $id) {
							... on User {
								name
							}
						}
					}
				`,
			},
		},
		{
			Title: "@loading happy path",
			Pass:  true,
			Documents: []string{
				`
					fragment LoadingDirectiveA on User {
						friendsConnection @loading {
							edges @loading {
								node @loading {
									firstName
								}
							}
						}
					}
				`,
			},
		},
		{
			Title: "@loading floating on fragment spread",
			Pass:  false,
			Documents: []string{
				`
					fragment UserInfo on User {
						id
					}
				`,
				`
					query A {
						user  {
							...UserInfo @loading
						}
					}
				`,
			},
		},
		{
			Title: "@loading must fall on inline fragment",
			Pass:  false,
			Documents: []string{
				`
					query A {
						node @loading {
							... on User {
								firstName @loading
							}
						}
					}
				`,
			},
		},
		{
			Title: "@optimisticKey on single key",
			Pass:  true,
			Documents: []string{
				`
					mutation B {
						addFriend  {
							friend {
								id @optimisticKey
							}
						}
					}
				`,
			},
		},
		{
			Title: "@optimisticKey on non-key",
			Pass:  false,
			Documents: []string{
				`
					mutation B {
						addFriend  {
							friend {
								firstName @optimisticKey
							}
						}
					}
				`,
			},
		},
		{
			Title: "@optimisticKey on multiple key - missing",
			Pass:  false,
			Documents: []string{
				`
					mutation A {
						updateGhost  {
							aka @optimisticKey
						}
					}
				`,
			},
		},
		{
			Title: "@optimisticKey on multiple key - found",
			Pass:  true,
			Documents: []string{
				`
					mutation A {
						updateGhost  {
							aka @optimisticKey
							name @optimisticKey
						}
					}
				`,
			},
		},
		{
			Title: "@optimisticKey on non-mutation",
			Pass:  false,
			Documents: []string{
				`
					query A {
						ghost  {
							aka @optimisticKey
							name @optimisticKey
						}
					}
				`,
			},
		},
		{
			Title: "@optimisticKey on object type",
			Pass:  false,
			Documents: []string{
				`
					mutation A {
						updateGhost @optimisticKey {
							aka
							name
						}
					}
				`,
			},
		},
		{
			Title: "@required may not be used on non-nullable fields",
			Pass:  false,
			Documents: []string{
				`
					query QueryA {
						user {
							firstName @required
						}
					}
				`,
			},
		},
		{
			Title: "@required may be used on non-nullable fields if the child is marked with @required",
			Pass:  true,
			Documents: []string{
				`
					query QueryA {
						user @required {
							parent @required {
								firstName
							}
						}
					}
				`,
			},
		},
		{
			Title: "@loading on inline fragment",
			Pass:  true,
			Documents: []string{
				`
					query A {
						node(id: "1") @loading {
							... on User @loading {
								firstName @loading
							}
						}
					}
				`,
			},
		},
		{
			Title: "runtime scalars",
			Pass:  true,
			Documents: []string{
				`
					query A($id: ViewerIDFromSession!) {
						node(id: $id) {
							id
						}
					}
				`,
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
			defer insertDefaultKeys.Finalize()
			err = db.ExecStatement(insertDefaultKeys, `["id"]`)
			if err != nil {
				t.Fatalf("failed insert default keys: %v", err)
			}

			insertTypeKeys, err := conn.Prepare(`insert into type_configs (name, keys) values (?, '["aka", "name"]')`)
			if err != nil {
				t.Fatalf("failed to prepare raw_documents insert: %v", err)
			}
			defer insertTypeKeys.Finalize()
			err = db.ExecStatement(insertTypeKeys, "Ghost")
			if err != nil {
				t.Fatalf("failed insert default keys: %v", err)
			}
			err = db.ExecStatement(insertTypeKeys, "Legend")
			if err != nil {
				t.Fatalf("failed insert default keys: %v", err)
			}

			insertRuntimeScalar, err := conn.Prepare(`insert into runtime_scalar_definitions (name, type) values (?, ?)`)
			if err != nil {
				t.Fatalf("failed to prepare raw_documents insert: %v", err)
			}
			defer insertRuntimeScalar.Finalize()
			err = db.ExecStatement(insertRuntimeScalar, "ViewerIDFromSession", "ID")
			if err != nil {
				t.Fatalf("failed insert runtime scalar: %v", err)
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
