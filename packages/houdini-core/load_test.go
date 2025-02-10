package main

import (
	"fmt"
	"sort"
	"strings"
	"testing"

	"code.houdinigraphql.com/plugins"
	"zombiezen.com/go/sqlite"
	"zombiezen.com/go/sqlite/sqlitex"
)

var tests = []testCase{
	{
		name: "simple query with nested fields and variable",
		rawQuery: `
            query TestQuery($id: ID!) {
                user(id: $id) {
                    id
                    name
                }
            }
        `,
		expectedDocs: []expectedDocument{
			{
				Name:        "TestQuery",
				RawDocument: 1,
				Kind:        "query",
				Variables: []operationVariableRow{
					{
						Document:     "TestQuery",
						VarName:      "id",
						Type:         "ID!",
						DefaultValue: nil,
					},
				},
				Selections: []expectedSelection{
					{
						FieldName: "user",
						Alias:     strPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Children: []expectedSelection{
							{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
							{FieldName: "name", Alias: strPtr("name"), PathIndex: 1, Kind: "field"},
						},
					},
				},
			},
		},
	},
	{
		name: "fragment definition with no variables",
		rawQuery: `
            fragment TestFragment on User {
                id
                email
            }
        `,
		expectedDocs: []expectedDocument{
			{
				Name:          "TestFragment",
				RawDocument:   1,
				Kind:          "fragment",
				TypeCondition: strPtr("User"),
				Selections: []expectedSelection{
					{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
					{FieldName: "email", Alias: strPtr("email"), PathIndex: 1, Kind: "field"},
				},
			},
		},
	},
	{
		name: "query with field arguments",
		rawQuery: `
            query TestQueryArgs {
                user(id: "123", active: true) {
                    id
                    name
                }
            }
        `,
		expectedDocs: []expectedDocument{
			{
				Name:        "TestQueryArgs",
				RawDocument: 1,
				Kind:        "query",
				Selections: []expectedSelection{
					{
						FieldName: "user",
						Alias:     strPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []expectedArgument{
							{Name: "id", Value: "\"123\""},
							{Name: "active", Value: "true"},
						},
						Children: []expectedSelection{
							{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
							{FieldName: "name", Alias: strPtr("name"), PathIndex: 1, Kind: "field"},
						},
					},
				},
			},
		},
	},
	{
		name: "query with inline fragment",
		rawQuery: `
            query TestQueryInline {
                user(id: "123") {
                    ... on User {
                        id
                        email
                    }
                }
            }
        `,
		expectedDocs: []expectedDocument{
			{
				Name:        "TestQueryInline",
				RawDocument: 1,
				Kind:        "query",
				Selections: []expectedSelection{
					{
						FieldName: "user",
						Alias:     strPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Children: []expectedSelection{
							{
								FieldName: "User",
								Alias:     nil,
								PathIndex: 0,
								Kind:      "inline_fragment",
								Children: []expectedSelection{
									{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
									{FieldName: "email", Alias: strPtr("email"), PathIndex: 1, Kind: "field"},
								},
							},
						},
					},
				},
			},
		},
	},
	{
		name: "query with directive",
		rawQuery: `
            query TestQueryDirective {
                user(id: "123") @include(if: true) {
                    id
                }
            }
        `,
		expectedDocs: []expectedDocument{
			{
				Name:        "TestQueryDirective",
				RawDocument: 1,
				Kind:        "query",
				Selections: []expectedSelection{
					{
						FieldName: "user",
						Alias:     strPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []expectedArgument{
							{Name: "id", Value: "\"123\""},
						},
						Directives: []expectedDirective{
							{
								Name: "include",
								Arguments: []expectedDirectiveArgument{
									{Name: "if", Value: "true"},
								},
							},
						},
						Children: []expectedSelection{
							{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
						},
					},
				},
			},
		},
	},
	{
		name: "query with alias fields",
		rawQuery: `
            query TestQueryAlias {
                u: userById(id: "123") {
                    fn: name
                    age
                }
            }
        `,
		expectedDocs: []expectedDocument{
			{
				Name:        "TestQueryAlias",
				RawDocument: 1,
				Kind:        "query",
				Selections: []expectedSelection{
					{
						FieldName: "userById",
						Alias:     strPtr("u"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []expectedArgument{
							{Name: "id", Value: "\"123\""},
						},
						Children: []expectedSelection{
							{FieldName: "name", Alias: strPtr("fn"), PathIndex: 0, Kind: "field"},
							{FieldName: "age", Alias: strPtr("age"), PathIndex: 1, Kind: "field"},
						},
					},
				},
			},
		},
	},
	{
		name: "query with variable default",
		rawQuery: `
            query TestQueryDefault($limit: Int = 10) {
                users(limit: $limit) {
                    id
                }
            }
        `,
		expectedDocs: []expectedDocument{
			{
				Name:        "TestQueryDefault",
				RawDocument: 1,
				Kind:        "query",
				Variables: []operationVariableRow{
					{Document: "TestQueryDefault", VarName: "limit", Type: "Int", DefaultValue: strPtr("10")},
				},
				Selections: []expectedSelection{
					{
						FieldName: "users",
						Alias:     strPtr("users"),
						PathIndex: 0,
						Kind:      "field",
						Children: []expectedSelection{
							{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
						},
					},
				},
			},
		},
	},
	{
		name: "query with multiple directives",
		rawQuery: `
            query TestQueryMultiDirective {
                user(id: "123") @include(if: true) @deprecated(reason: "old field") {
                    id
                }
            }
        `,
		expectedDocs: []expectedDocument{
			{
				Name:        "TestQueryMultiDirective",
				RawDocument: 1,
				Kind:        "query",
				Selections: []expectedSelection{
					{
						FieldName: "user",
						Alias:     strPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []expectedArgument{
							{Name: "id", Value: "\"123\""},
						},
						Directives: []expectedDirective{
							{
								Name: "include",
								Arguments: []expectedDirectiveArgument{
									{Name: "if", Value: "true"},
								},
							},
							{
								Name: "deprecated",
								Arguments: []expectedDirectiveArgument{
									{Name: "reason", Value: "\"old field\""},
								},
							},
						},
						Children: []expectedSelection{
							{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
						},
					},
				},
			},
		},
	},
	{
		name: "mutation with field arguments",
		rawQuery: `
            mutation TestMutation {
                updateUser(id: "123", name: "NewName") {
                    id
                    name
                }
            }
        `,
		expectedDocs: []expectedDocument{
			{
				Name:        "TestMutation",
				RawDocument: 1,
				Kind:        "mutation",
				Selections: []expectedSelection{
					{
						FieldName: "updateUser",
						Alias:     strPtr("updateUser"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []expectedArgument{
							{Name: "id", Value: "\"123\""},
							{Name: "name", Value: "\"NewName\""},
						},
						Children: []expectedSelection{
							{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
							{FieldName: "name", Alias: strPtr("name"), PathIndex: 1, Kind: "field"},
						},
					},
				},
			},
		},
	},
	{
		name: "subscription query",
		rawQuery: `
            subscription TestSubscription {
                userUpdated {
                    id
                    email
                }
            }
        `,
		expectedDocs: []expectedDocument{
			{
				Name:        "TestSubscription",
				RawDocument: 1,
				Kind:        "subscription",
				Selections: []expectedSelection{
					{
						FieldName: "userUpdated",
						Alias:     strPtr("userUpdated"),
						PathIndex: 0,
						Kind:      "field",
						Children: []expectedSelection{
							{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
							{FieldName: "email", Alias: strPtr("email"), PathIndex: 1, Kind: "field"},
						},
					},
				},
			},
		},
	},
	{
		name: "query with deeply nested inline fragments",
		rawQuery: `
            query TestDeepInline {
                user(id: "123") {
                    ... on User {
                        details: profile {
                            bio
                            ... on Profile {
                                picture
                            }
                        }
                    }
                }
            }
        `,
		expectedDocs: []expectedDocument{
			{
				Name:        "TestDeepInline",
				RawDocument: 1,
				Kind:        "query",
				Selections: []expectedSelection{
					{
						FieldName: "user",
						Alias:     strPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []expectedArgument{
							{Name: "id", Value: "\"123\""},
						},
						Children: []expectedSelection{
							{
								FieldName: "User",
								Alias:     nil,
								PathIndex: 0,
								Kind:      "inline_fragment",
								Children: []expectedSelection{
									{
										FieldName: "profile",
										Alias:     strPtr("details"),
										PathIndex: 0,
										Kind:      "field",
										Children: []expectedSelection{
											{FieldName: "bio", Alias: strPtr("bio"), PathIndex: 0, Kind: "field"},
											{
												FieldName: "Profile",
												Alias:     nil,
												PathIndex: 1,
												Kind:      "inline_fragment",
												Children: []expectedSelection{
													{FieldName: "picture", Alias: strPtr("picture"), PathIndex: 0, Kind: "field"},
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
		},
	},
	{
		name: "named fragment spread",
		rawQuery: `
            query TestNamedFragment {
                user(id: "123") {
                    ...UserFields
                }
            }
            fragment UserFields on User {
                id
                name
                email
            }
        `,
		// in this scenario the operation and fragment are stored as two separate documents.
		expectedDocs: []expectedDocument{
			{
				Name:        "TestNamedFragment",
				RawDocument: 1,
				Kind:        "query",
				Selections: []expectedSelection{
					{
						FieldName: "user",
						Alias:     strPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []expectedArgument{
							{Name: "id", Value: "\"123\""},
						},
						Children: []expectedSelection{
							{
								FieldName: "UserFields",
								Alias:     nil,
								PathIndex: 0,
								Kind:      "fragment",
							},
						},
					},
				},
			},
			{
				Name:          "UserFields",
				RawDocument:   1,
				Kind:          "fragment",
				TypeCondition: strPtr("User"),
				Selections: []expectedSelection{
					{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
					{FieldName: "name", Alias: strPtr("name"), PathIndex: 1, Kind: "field"},
					{FieldName: "email", Alias: strPtr("email"), PathIndex: 2, Kind: "field"},
				},
			},
		},
	},
	{
		name: "multiple operations in single document",
		rawQuery: `
            query FirstOperation {
                user { id }
            }
            query SecondOperation {
                user { name }
            }
        `,
		// both operations are stored as separate documents.
		expectedDocs: []expectedDocument{
			{
				Name:        "FirstOperation",
				RawDocument: 1,
				Kind:        "query",
				Selections: []expectedSelection{
					{
						FieldName: "user",
						Alias:     strPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Children: []expectedSelection{
							{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
						},
					},
				},
			},
			{
				Name:        "SecondOperation",
				RawDocument: 1,
				Kind:        "query",
				Selections: []expectedSelection{
					{
						FieldName: "user",
						Alias:     strPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Children: []expectedSelection{
							{FieldName: "name", Alias: strPtr("name"), PathIndex: 0, Kind: "field"},
						},
					},
				},
			},
		},
	},
	{
		name: "anonymous operation",
		rawQuery: `
            {
                user { id }
            }
        `,
		// anonymous operations are not allowed so this should produce an error.
		expectError: true,
	},
	{
		name: "complex field arguments",
		rawQuery: `
            query TestComplexArgs {
                search(filter: {term: "foo", tags: ["bar", "baz"]}) {
                    results { id }
                }
            }
        `,
		expectedDocs: []expectedDocument{
			{
				Name:        "TestComplexArgs",
				RawDocument: 1,
				Kind:        "query",
				Selections: []expectedSelection{
					{
						FieldName: "search",
						Alias:     strPtr("search"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []expectedArgument{
							// the nested object is normalized as a string.
							{Name: "filter", Value: "{term:\"foo\",tags:[\"bar\",\"baz\"]}"},
						},
						Children: []expectedSelection{
							{
								FieldName: "results",
								Alias:     strPtr("results"),
								PathIndex: 0,
								Kind:      "field",
								Children: []expectedSelection{
									{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
								},
							},
						},
					},
				},
			},
		},
	},
	{
		name: "variables in directives",
		rawQuery: `
            query TestVariableDirective($show: Boolean!) {
                user(id: "123") @include(if: $show) {
                    id
                }
            }
        `,
		expectedDocs: []expectedDocument{
			{
				Name:        "TestVariableDirective",
				RawDocument: 1,
				Kind:        "query",
				Variables: []operationVariableRow{
					{Document: "TestVariableDirective", VarName: "show", Type: "Boolean!", DefaultValue: nil},
				},
				Selections: []expectedSelection{
					{
						FieldName: "user",
						Alias:     strPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []expectedArgument{
							{Name: "id", Value: "\"123\""},
						},
						Directives: []expectedDirective{
							{
								Name: "include",
								Arguments: []expectedDirectiveArgument{
									{Name: "if", Value: "$show"},
								},
							},
						},
						Children: []expectedSelection{
							{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
						},
					},
				},
			},
		},
	},
	{
		name: "introspection fields",
		rawQuery: `
            query TestIntrospection {
                user {
                    __typename
                    id
                }
            }
        `,
		expectedDocs: []expectedDocument{
			{
				Name:        "TestIntrospection",
				RawDocument: 1,
				Kind:        "query",
				Selections: []expectedSelection{
					{
						FieldName: "user",
						Alias:     strPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Children: []expectedSelection{
							{FieldName: "__typename", Alias: strPtr("__typename"), PathIndex: 0, Kind: "field"},
							{FieldName: "id", Alias: strPtr("id"), PathIndex: 1, Kind: "field"},
						},
					},
				},
			},
		},
	},
	{
		name: "operation-level directives",
		rawQuery: `
            query TestOpDirective @cacheControl(maxAge: 60) {
                user { id }
            }
        `,
		expectedDocs: []expectedDocument{
			{
				Name:        "TestOpDirective",
				RawDocument: 1,
				Kind:        "query",
				Selections: []expectedSelection{
					{
						FieldName: "user",
						Alias:     strPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Children: []expectedSelection{
							{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
						},
					},
				},
			},
		},
	},
	{
		name: "interface inline fragment",
		rawQuery: `
            query TestInterface {
                search {
                    ... on Node {
                        id
                    }
                }
            }
        `,
		expectedDocs: []expectedDocument{
			{
				Name:        "TestInterface",
				RawDocument: 1,
				Kind:        "query",
				Selections: []expectedSelection{
					{
						FieldName: "search",
						Alias:     strPtr("search"),
						PathIndex: 0,
						Kind:      "field",
						Children: []expectedSelection{
							{
								FieldName: "Node",
								Alias:     nil,
								PathIndex: 0,
								Kind:      "inline_fragment",
								Children: []expectedSelection{
									{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
								},
							},
						},
					},
				},
			},
		},
	},
	{
		name: "deprecated field",
		rawQuery: `
            query TestDeprecated {
                user {
                    oldField @deprecated(reason: "Use newField")
                    newField
                }
            }
        `,
		expectedDocs: []expectedDocument{
			{
				Name:        "TestDeprecated",
				RawDocument: 1,
				Kind:        "query",
				Selections: []expectedSelection{
					{
						FieldName: "user",
						Alias:     strPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Children: []expectedSelection{
							{
								FieldName: "oldField",
								Alias:     strPtr("oldField"),
								PathIndex: 0,
								Kind:      "field",
								Directives: []expectedDirective{
									{
										Name: "deprecated",
										Arguments: []expectedDirectiveArgument{
											{Name: "reason", Value: "\"Use newField\""},
										},
									},
								},
							},
							{
								FieldName: "newField",
								Alias:     strPtr("newField"),
								PathIndex: 1,
								Kind:      "field",
							},
						},
					},
				},
			},
		},
	},
	{
		name: "fragment with directive",
		rawQuery: `
			fragment TestFragmentDirective on User @deprecated(reason: "old fragment") {
				id
				email
			}
		`,
		expectedDocs: []expectedDocument{
			{
				Name:          "TestFragmentDirective",
				RawDocument:   1,
				Kind:          "fragment",
				TypeCondition: strPtr("User"),
				Directives: []expectedDirective{
					{
						Name: "deprecated",
						Arguments: []expectedDirectiveArgument{
							{Name: "reason", Value: "\"old fragment\""},
						},
					},
				},
				Selections: []expectedSelection{
					{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
					{FieldName: "email", Alias: strPtr("email"), PathIndex: 1, Kind: "field"},
				},
			},
		},
	},
	{
		name: "cyclic fragment spreads",
		rawQuery: `
			query TestCycle {
				user {
					...A
				}
			}
			fragment A on User {
				...B
				name
			}
			fragment B on User {
				...A
				id
			}
		`,
		expectedDocs: []expectedDocument{
			{
				Name:        "TestCycle",
				RawDocument: 1,
				Kind:        "query",
				Selections: []expectedSelection{
					{
						FieldName: "user",
						Alias:     strPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Children: []expectedSelection{
							{
								FieldName: "A",
								Alias:     nil,
								PathIndex: 0,
								Kind:      "fragment",
							},
						},
					},
				},
			},
			{
				Name:          "A",
				RawDocument:   1,
				Kind:          "fragment",
				TypeCondition: strPtr("User"),
				Selections: []expectedSelection{
					{
						FieldName: "B",
						Alias:     nil,
						PathIndex: 0,
						Kind:      "fragment",
					},
					{
						FieldName: "name",
						Alias:     strPtr("name"),
						PathIndex: 1,
						Kind:      "field",
					},
				},
			},
			{
				Name:          "B",
				RawDocument:   1,
				Kind:          "fragment",
				TypeCondition: strPtr("User"),
				Selections: []expectedSelection{
					{
						FieldName: "A",
						Alias:     nil,
						PathIndex: 0,
						Kind:      "fragment",
					},
					{
						FieldName: "id",
						Alias:     strPtr("id"),
						PathIndex: 1,
						Kind:      "field",
					},
				},
			},
		},
	},
	{
		name: "complex default variable",
		rawQuery: `
			query TestComplexDefault($filter: FilterInput = {term: "foo", tags: ["bar", "baz"]}) {
				search(filter: $filter) {
					results { id }
				}
			}
		`,
		expectedDocs: []expectedDocument{
			{
				Name:        "TestComplexDefault",
				RawDocument: 1,
				Kind:        "query",
				Variables: []operationVariableRow{
					{
						Document:     "TestComplexDefault",
						VarName:      "filter",
						Type:         "FilterInput",
						DefaultValue: strPtr("{term:\"foo\",tags:[\"bar\",\"baz\"]}"),
					},
				},
				Selections: []expectedSelection{
					{
						FieldName: "search",
						Alias:     strPtr("search"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []expectedArgument{
							{Name: "filter", Value: "$filter"},
						},
						Children: []expectedSelection{
							{
								FieldName: "results",
								Alias:     strPtr("results"),
								PathIndex: 0,
								Kind:      "field",
								Children: []expectedSelection{
									{
										FieldName: "id",
										Alias:     strPtr("id"),
										PathIndex: 0,
										Kind:      "field",
									},
								},
							},
						},
					},
				},
			},
		},
	},
	{
		name: "empty inline fragment",
		rawQuery: `
			query TestEmptyInline {
				user(id: "123") {
					... on User { }
				}
			}
		`,
		expectError: true,
	},
	{
		name: "multiple operation-level directives",
		rawQuery: `
			query TestOpDirectives @directive1 @directive2(arg:"value") {
				user { id }
			}
		`,
		expectedDocs: []expectedDocument{
			{
				Name:        "TestOpDirectives",
				RawDocument: 1,
				Kind:        "query",
				Selections: []expectedSelection{
					{
						FieldName: "user",
						Alias:     strPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Children: []expectedSelection{
							{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
						},
					},
				},
			},
		},
	},
	{
		name: "inline fragment with directive",
		rawQuery: `
			query TestInlineDirectives {
				user(id: "123") {
					... on User @include(if: true) {
						id
						email
					}
				}
			}
		`,
		expectedDocs: []expectedDocument{
			{
				// This is the operation document for the query.
				Name:        "TestInlineDirectives",
				RawDocument: 1,
				Kind:        "query",
				Selections: []expectedSelection{
					{
						FieldName: "user",
						Alias:     strPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []expectedArgument{
							{Name: "id", Value: "\"123\""},
						},
						Children: []expectedSelection{
							{
								FieldName: "User",
								Alias:     nil,
								PathIndex: 0,
								Kind:      "inline_fragment",
								Directives: []expectedDirective{
									{
										Name: "include",
										Arguments: []expectedDirectiveArgument{
											{Name: "if", Value: "true"},
										},
									},
								},
								Children: []expectedSelection{
									{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
									{
										FieldName: "email",
										Alias:     strPtr("email"),
										PathIndex: 1,
										Kind:      "field",
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

func TestAfterExtract_loadsExtractedQueries(t *testing.T) {
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// create an in-memory db.
			db, err := plugins.InMemoryDB[PluginConfig]()
			if err != nil {
				t.Fatalf("failed to create in-memory db: %v", err)
			}
			defer db.Close()

			if err := executeSchema(db.Conn); err != nil {
				t.Fatalf("failed to create schema: %v", err)
			}

			// insert the raw document (assume id becomes 1).
			insertRaw, err := db.Conn.Prepare("insert into raw_documents (content, filepath) values (?, 'foo')")
			if err != nil {
				t.Fatalf("failed to prepare raw_documents insert: %v", err)
			}
			defer insertRaw.Finalize()
			if err := db.ExecStatement(insertRaw, tc.rawQuery); err != nil {
				t.Fatalf("failed to insert raw document: %v", err)
			}

			hc := &HoudiniCore{}
			hc.SetDatabase(db)

			statements, finalize := prepareDocumentInsertStatements(db)
			defer finalize()

			pending := PendingQuery{
				Query: tc.rawQuery,
				ID:    1,
			}

			err = hc.loadPendingQuery(pending, db, statements)
			if tc.expectError {
				if err == nil {
					t.Fatalf("expected an error for test %q but got none", tc.name)
				}
				// stop further checks when error is expected.
				return
			} else if err != nil {
				t.Fatalf("loadPendingQuery returned error: %v", err)
			}

			// fetch documents and compare with expectedDocs.
			docs := fetchDocuments(t, db)
			if len(docs) != len(tc.expectedDocs) {
				t.Errorf("expected %d documents, got %d", len(tc.expectedDocs), len(docs))
			}
			for _, expDoc := range tc.expectedDocs {
				var found bool
				for _, actual := range docs {
					if actual.Name == expDoc.Name {
						found = true
						if actual.RawDocument != expDoc.RawDocument ||
							actual.Kind != expDoc.Kind ||
							!strEqual(actual.TypeCondition, expDoc.TypeCondition) {
							t.Errorf("document mismatch for %s: expected %+v, got %+v", expDoc.Name, expDoc, actual)
						}
						// if operation, check operation variables.
						if expDoc.Kind == "query" || expDoc.Kind == "mutation" || expDoc.Kind == "subscription" {
							vars := fetchOperationVariables(t, db)
							if len(vars) != len(expDoc.Variables) {
								t.Errorf("for document %s, expected %d operation variables, got %d", expDoc.Name, len(expDoc.Variables), len(vars))
							}
							for i, expectedVar := range expDoc.Variables {
								if i >= len(vars) {
									break
								}
								actualVar := vars[i]
								if actualVar.Document != expectedVar.Document ||
									actualVar.VarName != expectedVar.VarName ||
									actualVar.Type != expectedVar.Type ||
									!strEqual(actualVar.DefaultValue, expectedVar.DefaultValue) {
									t.Errorf("for document %s, operation variable row %d mismatch: expected %+v, got %+v", expDoc.Name, i, expectedVar, actualVar)
								}
							}
						}

						// build and compare the selection tree.
						selectionsMap, rel, roots, err := buildSelectionTree(db, expDoc.Name)
						if err != nil {
							t.Fatalf("failed to build selection tree for document %s: %v", expDoc.Name, err)
						}
						actualTree := buildExpectedFromDB(selectionsMap, rel, roots)
						sortTree(actualTree)
						sortExpectedSelections(expDoc.Selections)
						if err := compareExpected(expDoc.Selections, actualTree); err != nil {
							t.Errorf("selection tree mismatch for document %s: %v", expDoc.Name, err)
						}
					}
				}
				if !found {
					t.Errorf("expected document %s not found", expDoc.Name)
				}
			}

			// verify that selection details (arguments, directives) are correct.
			dbSels := fetchSelections(t, db)
			for _, expDoc := range tc.expectedDocs {
				verifySelectionTreeDirectives(expDoc.Selections, dbSels, db, t)
			}
		})
	}
}

// expectedDocument represents an operation or fragment definition.
type expectedDocument struct {
	Name          string
	RawDocument   int
	Kind          string // "query", "mutation", "subscription", or "fragment"
	TypeCondition *string
	Variables     []operationVariableRow
	Selections    []expectedSelection
	Directives    []expectedDirective
}

type operationVariableRow struct {
	Document     string
	VarName      string
	Type         string
	DefaultValue *string
}

type expectedArgument struct {
	Name  string
	Value string
}

type expectedDirectiveArgument struct {
	Name  string
	Value string
}

type expectedDirective struct {
	Name      string
	Arguments []expectedDirectiveArgument
}

type expectedSelection struct {
	FieldName  string
	Alias      *string
	PathIndex  int
	Kind       string // "field", "fragment", "inline_fragment", etc.
	Arguments  []expectedArgument
	Directives []expectedDirective
	Children   []expectedSelection
}

type documentRow struct {
	Name          string
	RawDocument   int
	Kind          string
	TypeCondition *string
}

type dbSelection struct {
	ID        int
	FieldName string
	Alias     *string
	PathIndex int
	Kind      string
}

// testCase defines a test scenario.
type testCase struct {
	name         string
	rawQuery     string
	expectedDocs []expectedDocument
	expectError  bool
}

// sortExpectedSelections recursively sorts the expected selection slice.
func sortExpectedSelections(sels []expectedSelection) {
	sort.Slice(sels, func(i, j int) bool {
		return sels[i].PathIndex < sels[j].PathIndex
	})
	for i := range sels {
		sortExpectedSelections(sels[i].Children)
	}
}

// sortTree sorts the expected selection tree.
func sortTree(tree []expectedSelection) {
	sortExpectedSelections(tree)
}

// buildSelectionTree builds the selection tree for a given document.
// it returns a mapping of selection id to dbSelection, a parent-to-children map, and a slice of root selection ids.
func buildSelectionTree(db plugins.Database[PluginConfig], document string) (map[int]dbSelection, map[int][]int, []int, error) {
	// look up the document kind.
	var docKind string
	{
		stmt, err := db.Conn.Prepare("SELECT kind FROM documents WHERE name = ?")
		if err != nil {
			return nil, nil, nil, err
		}
		stmt.BindText(1, document)
		ok, err := stmt.Step()
		if err != nil {
			stmt.Finalize()
			return nil, nil, nil, err
		}
		if !ok {
			stmt.Finalize()
			return nil, nil, nil, fmt.Errorf("document %s not found", document)
		}
		docKind = stmt.ColumnText(0)
		stmt.Finalize()
	}

	// step 1. restrict to only those selections that have a matching selection_refs row.
	query := `SELECT s.id, s.field_name, s.alias, s.path_index, s.kind
FROM selections s
JOIN selection_refs sr ON s.id = sr.child_id
WHERE sr.document = ?
ORDER BY s.id`
	stmt, err := db.Conn.Prepare(query)
	if err != nil {
		return nil, nil, nil, err
	}
	stmt.BindText(1, document)
	filteredSelections := make(map[int]dbSelection)
	for {
		ok, err := stmt.Step()
		if err != nil {
			stmt.Finalize()
			return nil, nil, nil, err
		}
		if !ok {
			break
		}
		id := int(stmt.ColumnInt(0))
		var alias *string
		// alias is at column index 2.
		if stmt.ColumnType(2) == sqlite.TypeText {
			a := stmt.ColumnText(2)
			alias = &a
		}
		kind := stmt.ColumnText(4)
		filteredSelections[id] = dbSelection{
			ID:        id,
			FieldName: stmt.ColumnText(1),
			Alias:     alias,
			PathIndex: int(stmt.ColumnInt(3)),
			Kind:      kind,
		}
	}
	stmt.Finalize()

	// step 2. build the parent-to-children mapping for the given document.
	parentToChildren := make(map[int][]int)
	childIDs := make(map[int]struct{})
	stmt, err = db.Conn.Prepare("SELECT parent_id, child_id FROM selection_refs WHERE document = ?")
	if err != nil {
		return nil, nil, nil, err
	}
	stmt.BindText(1, document)
	for {
		ok, err := stmt.Step()
		if err != nil {
			stmt.Finalize()
			return nil, nil, nil, err
		}
		if !ok {
			break
		}
		// if parent_id is null then this row indicates a top-level selection; do not add mapping.
		if stmt.ColumnType(0) == sqlite.TypeNull {
			continue
		}
		parentID := int(stmt.ColumnInt(0))
		childID := int(stmt.ColumnInt(1))
		if _, ok := filteredSelections[childID]; ok {
			parentToChildren[parentID] = append(parentToChildren[parentID], childID)
			childIDs[childID] = struct{}{}
		}
	}
	stmt.Finalize()

	// step 3. determine the roots.
	roots := make([]int, 0)
	for id := range filteredSelections {
		if _, isChild := childIDs[id]; !isChild {
			roots = append(roots, id)
		}
	}

	// step 4. for fragment documents, flatten a dummy wrapper if present.
	if docKind == "fragment" && len(roots) == 1 {
		if rootSel, ok := filteredSelections[roots[0]]; ok && rootSel.FieldName == document {
			roots = parentToChildren[rootSel.ID]
		}
	}

	return filteredSelections, parentToChildren, roots, nil
}

// executeSchema creates the database schema.
func executeSchema(db *sqlite.Conn) error {
	statements := strings.Split(schema, ";")
	for _, stmt := range statements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}
		if err := sqlitex.ExecuteTransient(db, stmt, nil); err != nil {
			return err
		}
	}
	return nil
}

const schema = `
CREATE TABLE raw_documents (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	filepath TEXT NOT NULL,
	content TEXT NOT NULL
);

CREATE TABLE operation_variables (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	document TEXT NOT NULL,
	name TEXT NOT NULL,
	type TEXT NOT NULL,
	default_value TEXT,
	FOREIGN KEY (document) REFERENCES documents(name)
);

CREATE TABLE documents (
	name TEXT NOT NULL PRIMARY KEY,
	kind TEXT NOT NULL CHECK (kind IN ('query', 'mutation', 'subscription', 'fragment')),
	raw_document INTEGER NOT NULL,
	type_condition TEXT,
	FOREIGN KEY (raw_document) REFERENCES raw_documents(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE selections (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	field_name TEXT NOT NULL,
	kind TEXT NOT NULL CHECK (kind IN ('field', 'fragment', 'inline_fragment', 'fragment')),
	alias TEXT,
	path_index INTEGER NOT NULL
);

CREATE TABLE selection_directives (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	selection_id INTEGER NOT NULL,
	directive TEXT NOT NULL,
	FOREIGN KEY (selection_id) REFERENCES selections(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE selection_directive_arguments (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	parent INTEGER NOT NULL,
	name TEXT NOT NULL,
	value TEXT NOT NULL,
	FOREIGN KEY (parent) REFERENCES selection_directives(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE selection_refs (
	parent_id INTEGER,
	child_id INTEGER NOT NULL,
	document TEXT NOT NULL,
	FOREIGN KEY (parent_id) REFERENCES selections(id) DEFERRABLE INITIALLY DEFERRED,
	FOREIGN KEY (child_id) REFERENCES selections(id) DEFERRABLE INITIALLY DEFERRED,
	FOREIGN KEY (document) REFERENCES documents(name) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE selection_arguments (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	selection_id INTEGER NOT NULL,
	name TEXT NOT NULL,
	value TEXT NOT NULL,
	FOREIGN KEY (selection_id) REFERENCES selections(id) DEFERRABLE INITIALLY DEFERRED
);
`

func fetchDocuments(t *testing.T, db plugins.Database[PluginConfig]) []documentRow {
	stmt, err := db.Conn.Prepare("select name, raw_document, kind, type_condition from documents order by name")
	if err != nil {
		t.Fatalf("failed to prepare documents query: %v", err)
	}
	defer stmt.Finalize()

	var rows []documentRow
	for {
		ok, err := stmt.Step()
		if err != nil {
			t.Fatalf("error stepping documents query: %v", err)
		}
		if !ok {
			break
		}
		var tc *string
		if stmt.ColumnType(3) == sqlite.TypeText {
			s := stmt.ColumnText(3)
			tc = &s
		}
		rows = append(rows, documentRow{
			Name:          stmt.ColumnText(0),
			RawDocument:   int(stmt.ColumnInt(1)),
			Kind:          stmt.ColumnText(2),
			TypeCondition: tc,
		})
	}
	return rows
}

func fetchOperationVariables(t *testing.T, db plugins.Database[PluginConfig]) []operationVariableRow {
	stmt, err := db.Conn.Prepare("select document, name, type, default_value from operation_variables order by name")
	if err != nil {
		t.Fatalf("failed to prepare operation_variables query: %v", err)
	}
	defer stmt.Finalize()

	var rows []operationVariableRow
	for {
		ok, err := stmt.Step()
		if err != nil {
			t.Fatalf("error stepping operation_variables query: %v", err)
		}
		if !ok {
			break
		}
		var dv *string
		if stmt.ColumnType(3) == sqlite.TypeText {
			s := stmt.ColumnText(3)
			dv = &s
		}
		rows = append(rows, operationVariableRow{
			Document:     stmt.ColumnText(0),
			VarName:      stmt.ColumnText(1),
			Type:         stmt.ColumnText(2),
			DefaultValue: dv,
		})
	}
	return rows
}

func fetchSelections(t *testing.T, db plugins.Database[PluginConfig]) []dbSelection {
	stmt, err := db.Conn.Prepare("select id, field_name, alias, path_index, kind from selections order by id")
	if err != nil {
		t.Fatalf("failed to prepare selections query: %v", err)
	}
	defer stmt.Finalize()

	var rows []dbSelection
	for {
		ok, err := stmt.Step()
		if err != nil {
			t.Fatalf("error stepping selections query: %v", err)
		}
		if !ok {
			break
		}
		var alias *string
		if stmt.ColumnType(2) == sqlite.TypeText {
			a := stmt.ColumnText(2)
			alias = &a
		}
		rows = append(rows, dbSelection{
			ID:        int(stmt.ColumnInt(0)),
			FieldName: stmt.ColumnText(1),
			Alias:     alias,
			PathIndex: int(stmt.ColumnInt(3)),
			Kind:      stmt.ColumnText(4),
		})
	}
	return rows
}

// buildExpectedFromDB converts the db selection tree into a nested expectedSelection structure.
func buildExpectedFromDB(selections map[int]dbSelection, rel map[int][]int, rootIDs []int) []expectedSelection {
	var result []expectedSelection
	for _, id := range rootIDs {
		sel := selections[id]
		result = append(result, expectedSelection{
			FieldName:  sel.FieldName,
			Alias:      sel.Alias,
			PathIndex:  sel.PathIndex,
			Kind:       sel.Kind,
			Arguments:  nil,
			Directives: nil,
			Children:   buildExpectedFromDB(selections, rel, rel[sel.ID]),
		})
	}
	return result
}

func compareExpected(expected, actual []expectedSelection) error {
	if len(expected) != len(actual) {
		return fmt.Errorf("expected %d selections, got %d", len(expected), len(actual))
	}
	for i := range expected {
		if expected[i].FieldName != actual[i].FieldName ||
			!strEqual(expected[i].Alias, actual[i].Alias) ||
			expected[i].PathIndex != actual[i].PathIndex ||
			expected[i].Kind != actual[i].Kind {
			return fmt.Errorf("mismatch at index %d: expected %+v, got %+v", i, expected[i], actual[i])
		}
		if err := compareExpected(expected[i].Children, actual[i].Children); err != nil {
			return err
		}
	}
	return nil
}

func verifySelectionDetails(t *testing.T, db plugins.Database[PluginConfig], selectionID int, expected expectedSelection) {
	actualArgs := fetchSelectionArgumentsForSelection(t, db, selectionID)
	if len(actualArgs) != len(expected.Arguments) {
		t.Errorf("for selection id %d, expected %d arguments, got %d", selectionID, len(expected.Arguments), len(actualArgs))
	} else {
		for i, expArg := range expected.Arguments {
			actArg := actualArgs[i]
			if actArg.Name != expArg.Name || actArg.Value != expArg.Value {
				t.Errorf("for selection id %d argument %d, expected %+v, got %+v", selectionID, i, expArg, actArg)
			}
		}
	}

	actualDirs := fetchSelectionDirectivesForSelection(t, db, selectionID)
	if len(actualDirs) != len(expected.Directives) {
		t.Errorf("for selection id %d, expected %d directives, got %d", selectionID, len(expected.Directives), len(actualDirs))
	} else {
		for i, expDir := range expected.Directives {
			actDir := actualDirs[i]
			if actDir.Name != expDir.Name {
				t.Errorf("for selection id %d directive %d, expected name %s, got %s", selectionID, i, expDir.Name, actDir.Name)
			}
			if len(actDir.Arguments) != len(expDir.Arguments) {
				t.Errorf("for selection id %d directive %s, expected %d arguments, got %d", selectionID, expDir.Name, len(expDir.Arguments), len(actDir.Arguments))
			} else {
				for j, expDArg := range expDir.Arguments {
					actDArg := actDir.Arguments[j]
					if actDArg.Name != expDArg.Name || actDArg.Value != expDArg.Value {
						t.Errorf("for selection id %d directive %s argument %d, expected %+v, got %+v", selectionID, expDir.Name, j, expDArg, actDArg)
					}
				}
			}
		}
	}
}

func verifySelectionTreeDirectives(expectedTree []expectedSelection, dbSelections []dbSelection, db plugins.Database[PluginConfig], t *testing.T) {
	for _, exp := range expectedTree {
		if len(exp.Arguments) > 0 || len(exp.Directives) > 0 {
			if sel, found := findDBSelection(exp, dbSelections); found {
				verifySelectionDetails(t, db, sel.ID, exp)
			} else {
				t.Errorf("could not find db selection matching expected %+v", exp)
			}
		}
		if len(exp.Children) > 0 {
			verifySelectionTreeDirectives(exp.Children, dbSelections, db, t)
		}
	}
}

func findDBSelection(expected expectedSelection, dbSelections []dbSelection) (dbSelection, bool) {
	for _, s := range dbSelections {
		effAlias := s.Alias
		if s.FieldName == expected.FieldName && s.PathIndex == expected.PathIndex && s.Kind == expected.Kind && strEqual(effAlias, expected.Alias) {
			return s, true
		}
	}
	return dbSelection{}, false
}

func fetchSelectionArgumentsForSelection(t *testing.T, db plugins.Database[PluginConfig], selectionID int) []expectedArgument {
	stmt, err := db.Conn.Prepare("select name, value from selection_arguments where selection_id = ? order by id")
	if err != nil {
		t.Fatalf("failed to prepare selection_arguments query: %v", err)
	}
	defer stmt.Finalize()

	stmt.BindInt64(1, int64(selectionID))
	var args []expectedArgument
	for {
		ok, err := stmt.Step()
		if err != nil {
			t.Fatalf("error stepping selection_arguments query: %v", err)
		}
		if !ok {
			break
		}
		args = append(args, expectedArgument{
			Name:  stmt.ColumnText(0),
			Value: stmt.ColumnText(1),
		})
	}
	return args
}

func fetchSelectionDirectivesForSelection(t *testing.T, db plugins.Database[PluginConfig], selectionID int) []expectedDirective {
	stmt, err := db.Conn.Prepare("select id, directive from selection_directives where selection_id = ? order by id")
	if err != nil {
		t.Fatalf("failed to prepare selection_directives query: %v", err)
	}
	defer stmt.Finalize()

	stmt.BindInt64(1, int64(selectionID))
	var directives []expectedDirective
	for {
		ok, err := stmt.Step()
		if err != nil {
			t.Fatalf("error stepping selection_directives query: %v", err)
		}
		if !ok {
			break
		}
		dirID := int(stmt.ColumnInt(0))
		dirName := stmt.ColumnText(1)
		argStmt, err := db.Conn.Prepare("select name, value from selection_directive_arguments where parent = ? order by id")
		if err != nil {
			t.Fatalf("failed to prepare selection_directive_arguments query: %v", err)
		}
		argStmt.BindInt64(1, int64(dirID))
		var dirArgs []expectedDirectiveArgument
		for {
			ok, err := argStmt.Step()
			if err != nil {
				t.Fatalf("error stepping selection_directive_arguments query: %v", err)
			}
			if !ok {
				break
			}
			dirArgs = append(dirArgs, expectedDirectiveArgument{
				Name:  argStmt.ColumnText(0),
				Value: argStmt.ColumnText(1),
			})
		}
		argStmt.Finalize()
		directives = append(directives, expectedDirective{
			Name:      dirName,
			Arguments: dirArgs,
		})
	}
	return directives
}

func strPtr(s string) *string {
	return &s
}

func strEqual(a, b *string) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil {
		return *b == ""
	}
	if b == nil {
		return *a == ""
	}
	return *a == *b
}
