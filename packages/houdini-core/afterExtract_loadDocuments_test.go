package main

import (
	"fmt"
	"sort"
	"strings"
	"testing"

	"code.houdinigraphql.com/plugins"
	"zombiezen.com/go/sqlite"
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
				Name: "TestQuery",
				Kind: "query",
				Variables: []operationVariableRow{
					{
						Document:      1,
						VarName:       "id",
						Type:          "ID",
						TypeModifiers: "!",
						DefaultValue:  nil,
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
				Name: "TestQueryArgs",
				Kind: "query",
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
				Name: "TestQueryInline",
				Kind: "query",
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
				Name: "TestQueryDirective",
				Kind: "query",
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
				Name: "TestQueryAlias",
				Kind: "query",
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
				Name: "TestQueryDefault",
				Kind: "query",
				Variables: []operationVariableRow{
					{
						Document:     1,
						VarName:      "limit",
						Type:         "Int",
						DefaultValue: strPtr("10"),
					},
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
				Name: "TestQueryMultiDirective",
				Kind: "query",
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
				Name: "TestMutation",
				Kind: "mutation",
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
				Name: "TestSubscription",
				Kind: "subscription",
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
				Name: "TestDeepInline",
				Kind: "query",
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
				Name: "TestNamedFragment",
				Kind: "query",
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
				Name: "FirstOperation",
				Kind: "query",
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
				Name: "SecondOperation",
				Kind: "query",
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
				Name: "TestComplexArgs",
				Kind: "query",
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
				Name: "TestVariableDirective",
				Kind: "query",
				Variables: []operationVariableRow{
					{Document: 1, VarName: "show", Type: "Boolean", TypeModifiers: "!", DefaultValue: nil},
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
				Name: "TestIntrospection",
				Kind: "query",
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
				Name: "TestInterface",
				Kind: "query",
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
				Name: "TestDeprecated",
				Kind: "query",
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
				Name: "TestCycle",
				Kind: "query",
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
		name: "component fields",
		rawQuery: `{
			... on User @componentField(field: "Avatar") {
				avatar
			}
		}`,
		inlineComponentField:     true,
		inlineComponentFieldProp: strPtr("user"),
		expectedDocs: []expectedDocument{
			{
				Name:          componentFieldFragmentName("User", "Avatar"),
				Kind:          "fragment",
				TypeCondition: strPtr("User"),
				Selections: []expectedSelection{
					{
						FieldName: "avatar",
						Alias:     strPtr("avatar"),
						PathIndex: 0,
						Kind:      "field",
					},
				},
				Directives: []expectedDirective{
					{
						Name: "componentField",
						Arguments: []expectedDirectiveArgument{
							{Name: "field", Value: "\"Avatar\""},
							{Name: "prop", Value: "\"user\""},
						},
					},
				},
			},
		},
	},
	{
		name: "component fields with multiple selections",
		rawQuery: `{
			... on User @componentField(field: "Avatar") {
				avatar
			}
			... on User @componentField(field: "Avatar2") {
				avatar
			}
		}`,
		inlineComponentField:     true,
		inlineComponentFieldProp: strPtr("user"),
		expectError:              true,
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
				Name: "TestComplexDefault",
				Kind: "query",
				Variables: []operationVariableRow{
					{
						Document:     1,
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
				Name: "TestInlineDirectives",
				Kind: "query",
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
	{
		name: "operation-level directives",
		rawQuery: `
				query TestOpDirective @cacheControl(maxAge: 60) {
					user { id }
				}
			`,
		expectedDocs: []expectedDocument{
			{
				Name: "TestOpDirective",
				Kind: "query",
				Directives: []expectedDirective{
					{
						Name: "cacheControl",
						Arguments: []expectedDirectiveArgument{
							{Name: "maxAge", Value: "60"},
						},
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
						},
					},
				},
			},
		},
	},
	{
		name: "operation-argument directives",
		rawQuery: `
				query TestOpDirective($arg: String @cacheControl(maxAge: 60)) {
					user { id }
				}
			`,
		expectedDocs: []expectedDocument{
			{
				Name: "TestOpDirective",
				Kind: "query",
				Variables: []operationVariableRow{
					{
						Document:     1,
						VarName:      "arg",
						Type:         "String",
						DefaultValue: nil,
						Directives: []expectedDirective{
							{
								Name: "cacheControl",
								Arguments: []expectedDirectiveArgument{
									{Name: "maxAge", Value: "60"},
								},
							},
						},
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
						},
					},
				},
			},
		},
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
				Name: "TestOpDirectives",
				Kind: "query",
				Directives: []expectedDirective{
					{Name: "directive1", Arguments: []expectedDirectiveArgument{}},
					{Name: "directive2", Arguments: []expectedDirectiveArgument{
						{Name: "arg", Value: "\"value\""},
					}},
				},
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

			// ─── POPULATE THE SCHEMA ─────────────────────────────────────────────
			// Insert rows into "type_fields" so that the lookup in processSelection
			// (i.e. SELECT type FROM type_fields WHERE id = ?)
			// finds the correct types.
			// (The types here are arbitrary as long as they allow subsequent lookups to succeed.)
			typeFields := []struct {
				id  string
				typ string
			}{
				{"Query.user", "User"},
				{"Query.userById", "User"},
				{"Query.users", "User"},
				{"Query.search", "SearchResult"},
				{"Mutation.updateUser", "User"},
				{"Subscription.userUpdated", "User"},
				{"User.id", "ID"},
				{"User.name", "String"},
				{"User.email", "String"},
				{"User.age", "Int"},
				{"User.profile", "Profile"},
				{"User.oldField", "String"},
				{"User.newField", "String"},
				{"User.__typename", "String"},
				{"User.avatar", "Avatar"},
				{"Profile.bio", "String"},
				{"Profile.picture", "String"},
				{"SearchResult.results", "Result"},
				{"Result.id", "ID"},
				{"Node.id", "ID"},
			}

			insertTypeField, err := db.Conn.Prepare("INSERT INTO type_fields (id, type, parent, name) VALUES (?, ?, ?, ?)")
			if err != nil {
				t.Fatalf("failed to prepare type_fields insert: %v", err)
			}
			defer insertTypeField.Finalize()

			for _, tf := range typeFields {
				typeParams := strings.Split(tf.id, ".")
				if err := db.ExecStatement(insertTypeField, tf.id, tf.typ, typeParams[0], typeParams[1]); err != nil {
					t.Fatalf("failed to insert type_field %s: %v", tf.id, err)
				}
			}

			// ─────────────────────────────────────────────────────────────────────

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

			statements, finalize := (&HoudiniCore{}).prepareDocumentInsertStatements(db)
			defer finalize()

			pending := PendingQuery{
				Query:                    tc.rawQuery,
				ID:                       1,
				InlineComponentField:     tc.inlineComponentField,
				InlineComponentFieldProp: tc.inlineComponentFieldProp,
			}

			pendingErr := hc.afterExtract_loadPendingQuery(pending, db, statements)
			if tc.expectError {
				if pendingErr == nil {
					t.Fatalf("expected an error for test %q but got none", tc.name)
				}
				// stop further checks when error is expected.
				return
			} else if pendingErr != nil {
				t.Fatalf("loadPendingQuery returned error: %v", err)
			}

			// fetch documents and compare with expectedDocs.
			documents := fetchDocuments(t, db)
			if len(documents) != len(tc.expectedDocs) {
				t.Errorf("expected %d documents, got %d", len(tc.expectedDocs), len(documents))
			}
			// we need to sort the docs so that they fall in the same order as the test
			docs := make([]documentRow, len(documents))
			for i, doc := range tc.expectedDocs {
				found := false
				// look for the document with the expected name
				for _, actual := range documents {
					if actual.Name == doc.Name {
						docs[i] = actual
						found = true
						break
					}
				}

				if !found {
					t.Fatal("could not find document with name " + doc.Name)
				}
			}
			for _, expDoc := range tc.expectedDocs {
				var found bool
				for _, actual := range docs {
					if actual.Name == expDoc.Name {
						found = true

						// Compare document metadata.
						if actual.Kind != expDoc.Kind ||
							!strEqual(actual.TypeCondition, expDoc.TypeCondition) {
							t.Errorf("document mismatch for %s: expected %+v, got %+v", expDoc.Name, expDoc, actual)
						}

						// If the document is an operation, check its operation variables.
						if expDoc.Kind == "query" || expDoc.Kind == "mutation" || expDoc.Kind == "subscription" {
							vars := findOperationVariables(t, db)
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
								// Check directives attached to the operation variable.
								if len(expectedVar.Directives) != len(actualVar.Directives) {
									t.Errorf("for document %s, operation variable %s expected %d directives, got %d", expDoc.Name, expectedVar.VarName, len(expectedVar.Directives), len(actualVar.Directives))
								} else {
									for j, expDir := range expectedVar.Directives {
										actDir := actualVar.Directives[j]
										if actDir.Name != expDir.Name {
											t.Errorf("for document %s, operation variable %s directive %d mismatch: expected %s, got %s", expDoc.Name, expectedVar.VarName, j, expDir.Name, actDir.Name)
										}
										if len(expDir.Arguments) != len(actDir.Arguments) {
											t.Errorf("for document %s, operation variable %s directive %s expected %d arguments, got %d", expDoc.Name, expectedVar.VarName, expDir.Name, len(expDir.Arguments), len(actDir.Arguments))
										} else {
											for k, expArg := range expDir.Arguments {
												actArg := actDir.Arguments[k]
												if actArg.Name != expArg.Name || actArg.Value != expArg.Value {
													t.Errorf("for document %s, operation variable %s directive %s argument %d mismatch: expected %+v, got %+v", expDoc.Name, expectedVar.VarName, expDir.Name, k, expArg, actArg)
												}
											}
										}
									}
								}
							}
						}

						// Build and compare the selection tree.
						selectionsMap, rel, roots, err := buildSelectionTree(db, int64(actual.ID))
						if err != nil {
							t.Fatalf("failed to build selection tree for document %s: %v", expDoc.Name, err)
						}
						actualTree := buildExpectedFromDB(selectionsMap, rel, roots)
						sortTree(actualTree)
						sortExpectedSelections(expDoc.Selections)
						if err := compareExpected(expDoc.Selections, actualTree); err != nil {
							t.Errorf("selection tree mismatch for document %s: %v", expDoc.Name, err)
						}

						// Finally, verify that the document-level directives match.
						docDirectives := fetchDocumentDirectives(t, db, int64(actual.ID))
						if len(docDirectives) != len(expDoc.Directives) {
							t.Errorf("for document %s, expected %d document directives, got %d", expDoc.Name, len(expDoc.Directives), len(docDirectives))
						} else {
							for i, expDir := range expDoc.Directives {
								actDir := docDirectives[i]
								if actDir.Name != expDir.Name {
									t.Errorf("document %s, directive %d: expected %s, got %s", expDoc.Name, i, expDir.Name, actDir.Name)
								}
								if len(actDir.Arguments) != len(expDir.Arguments) {
									t.Errorf("document %s, directive %s: expected %d arguments, got %d", expDoc.Name, expDir.Name, len(expDir.Arguments), len(actDir.Arguments))
								} else {
									for j, expArg := range expDir.Arguments {
										actArg := actDir.Arguments[j]
										if actArg.Name != expArg.Name || actArg.Value != expArg.Value {
											t.Errorf("document %s, directive %s argument %d mismatch: expected %+v, got %+v", expDoc.Name, expDir.Name, j, expArg, actArg)
										}
									}
								}
							}
						}
					}
				}
				if !found {
					t.Errorf("expected document %s not found", expDoc.Name)
				}
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
	Document      int
	VarName       string
	Type          string
	TypeModifiers string
	DefaultValue  *string
	Directives    []expectedDirective
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
	ID            int
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
	name                     string
	rawQuery                 string
	inlineComponentField     bool
	inlineComponentFieldProp *string
	expectedDocs             []expectedDocument
	expectError              bool
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
func buildSelectionTree(db plugins.Database[PluginConfig], document int64) (map[int]dbSelection, map[int][]int, []int, error) {
	stmt, err := db.Conn.Prepare("SELECT kind FROM documents WHERE id = ?")
	if err != nil {
		return nil, nil, nil, err
	}
	stmt.BindInt64(1, document)
	ok, err := stmt.Step()
	if err != nil {
		stmt.Finalize()
		return nil, nil, nil, err
	}
	if !ok {
		stmt.Finalize()
		return nil, nil, nil, fmt.Errorf("document %v not found", document)
	}
	stmt.Finalize()

	// step 1. restrict to only those selections that have a matching selection_refs row.
	query := `SELECT s.id, s.field_name, s.alias, s.path_index, s.kind
FROM selections s
JOIN selection_refs sr ON s.id = sr.child_id
WHERE sr.document = ?
ORDER BY s.id`
	stmt, err = db.Conn.Prepare(query)
	if err != nil {
		return nil, nil, nil, err
	}
	stmt.BindInt64(1, document)
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
	stmt.BindInt64(1, document)
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

	return filteredSelections, parentToChildren, roots, nil
}

func fetchDocuments(t *testing.T, db plugins.Database[PluginConfig]) []documentRow {
	stmt, err := db.Conn.Prepare("select name, raw_document, kind, type_condition, id from documents order by name")
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
			ID:            int(stmt.ColumnInt(4)),
			Name:          stmt.ColumnText(0),
			RawDocument:   int(stmt.ColumnInt(1)),
			Kind:          stmt.ColumnText(2),
			TypeCondition: tc,
		})
	}
	return rows
}

// findOperationVariables returns all operation variables along with any attached directives.
func findOperationVariables(t *testing.T, db plugins.Database[PluginConfig]) []operationVariableRow {
	// Note: we now select the id as well so that we can look up directives.
	stmt, err := db.Conn.Prepare(`
		SELECT id, document, name, type, default_value, type_modifiers
		FROM operation_variables
		ORDER BY name
	`)
	if err != nil {
		t.Fatalf("failed to prepare operation_variables query: %v", err)
	}
	defer stmt.Finalize()

	var variables []operationVariableRow
	for {
		ok, err := stmt.Step()
		if err != nil {
			t.Fatalf("error stepping operation_variables query: %v", err)
		}
		if !ok {
			break
		}

		// Read the default value (if any)
		var defaultValue *string
		if stmt.ColumnType(4) == sqlite.TypeText {
			s := stmt.ColumnText(4)
			defaultValue = &s
		}

		// Grab the id for later lookup of directives.
		varID := int(stmt.ColumnInt(0))
		opVar := operationVariableRow{
			Document:      stmt.ColumnInt(1),
			VarName:       stmt.ColumnText(2),
			Type:          stmt.ColumnText(3),
			TypeModifiers: stmt.ColumnText(4),
			DefaultValue:  defaultValue,
		}

		// Look up any directives attached to this variable.
		directives := findOperationVariableDirectives(t, db, varID)
		if err != nil {
			t.Fatalf("failed to lookup directives for variable %s: %v", opVar.VarName, err)
		}
		opVar.Directives = directives

		variables = append(variables, opVar)
	}
	return variables
}

// findOperationVariableDirectives looks up all directives for a given operation variable.
func findOperationVariableDirectives(t *testing.T, db plugins.Database[PluginConfig], variableID int) []expectedDirective {
	stmt, err := db.Conn.Prepare(`
		SELECT id, directive
		FROM operation_variable_directives
		WHERE parent = ?
		ORDER BY id
	`)
	if err != nil {
		t.Fatalf("failed to prepare operation_variable_directives query: %v", err)
	}
	defer stmt.Finalize()

	// Bind the operation variable id.
	stmt.BindInt64(1, int64(variableID))

	var directives []expectedDirective
	for {
		ok, err := stmt.Step()
		if err != nil {
			t.Fatalf("error stepping operation_variable_directives query: %v", err)
		}
		if !ok {
			break
		}

		// Get the id and name of the directive.
		dirID := int(stmt.ColumnInt(0))
		dirName := stmt.ColumnText(1)

		// Now look up any arguments for this directive.
		args, err := findOperationVariableDirectiveArguments(db, dirID)
		if err != nil {
			t.Fatalf("failed to fetch arguments for directive %s: %v", dirName, err)
		}

		directives = append(directives, expectedDirective{
			Name:      dirName,
			Arguments: args,
		})
	}
	return directives
}

// findOperationVariableDirectiveArguments retrieves all arguments for a given variable directive.
func findOperationVariableDirectiveArguments(db plugins.Database[PluginConfig], directiveID int) ([]expectedDirectiveArgument, error) {
	stmt, err := db.Conn.Prepare(`
		SELECT name, value
		FROM operation_variable_directive_arguments
		WHERE parent = ?
		ORDER BY id
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare operation_variable_directive_arguments query: %v", err)
	}
	defer stmt.Finalize()

	stmt.BindInt64(1, int64(directiveID))

	var args []expectedDirectiveArgument
	for {
		ok, err := stmt.Step()
		if err != nil {
			return nil, fmt.Errorf("error stepping operation_variable_directive_arguments query: %v", err)
		}
		if !ok {
			break
		}

		args = append(args, expectedDirectiveArgument{
			Name:  stmt.ColumnText(0),
			Value: stmt.ColumnText(1),
		})
	}
	return args, nil
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

func fetchDocumentDirectives(t *testing.T, db plugins.Database[PluginConfig], document int64) []expectedDirective {
	stmt, err := db.Conn.Prepare("SELECT id, directive FROM document_directives WHERE document = ? ORDER BY id")
	if err != nil {
		t.Fatalf("failed to prepare document_directives query: %v", err)
	}
	defer stmt.Finalize()

	stmt.BindInt64(1, document)

	var directives []expectedDirective
	for {
		ok, err := stmt.Step()
		if err != nil {
			t.Fatalf("error stepping document_directives query: %v", err)
		}
		if !ok {
			break
		}
		id := int(stmt.ColumnInt(0))
		dirName := stmt.ColumnText(1)

		argStmt, err := db.Conn.Prepare("SELECT name, value FROM document_directive_arguments WHERE parent = ? ORDER BY id")
		if err != nil {
			t.Fatalf("failed to prepare document_directives_argument query: %v", err)
		}
		argStmt.BindInt64(1, int64(id))
		var args []expectedDirectiveArgument
		for {
			ok, err := argStmt.Step()
			if err != nil {
				t.Fatalf("error stepping document_directives_argument query: %v", err)
			}
			if !ok {
				break
			}
			args = append(args, expectedDirectiveArgument{
				Name:  argStmt.ColumnText(0),
				Value: argStmt.ColumnText(1),
			})
		}
		argStmt.Finalize()
		directives = append(directives, expectedDirective{
			Name:      dirName,
			Arguments: args,
		})
	}
	return directives
}
