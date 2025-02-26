package documents_test

import (
	"context"
	"strings"
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/packages/houdini-core/plugin/schema"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
	"github.com/stretchr/testify/require"
)

var loadDocumentsTable = []testCase{
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
		expectedDocs: []tests.ExpectedDocument{
			{
				Name: "TestQuery",
				Kind: "query",
				Variables: []tests.ExpectedOperationVariable{
					{
						Document:      1,
						VarName:       "id",
						Type:          "ID",
						TypeModifiers: "!",
						DefaultValue:  nil,
					},
				},
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "user",
						Alias:     tests.StrPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Children: []tests.ExpectedSelection{
							{FieldName: "id", Alias: tests.StrPtr("id"), PathIndex: 0, Kind: "field"},
							{FieldName: "name", Alias: tests.StrPtr("name"), PathIndex: 1, Kind: "field"},
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
		expectedDocs: []tests.ExpectedDocument{
			{
				Name:          "TestFragment",
				RawDocument:   1,
				Kind:          "fragment",
				TypeCondition: tests.StrPtr("User"),
				Selections: []tests.ExpectedSelection{
					{FieldName: "id", Alias: tests.StrPtr("id"), PathIndex: 0, Kind: "field"},
					{FieldName: "email", Alias: tests.StrPtr("email"), PathIndex: 1, Kind: "field"},
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
		expectedDocs: []tests.ExpectedDocument{
			{
				Name: "TestQueryArgs",
				Kind: "query",
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "user",
						Alias:     tests.StrPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []tests.ExpectedArgument{
							{Name: "id", Value: "\"123\""},
							{Name: "active", Value: "true"},
						},
						Children: []tests.ExpectedSelection{
							{FieldName: "id", Alias: tests.StrPtr("id"), PathIndex: 0, Kind: "field"},
							{FieldName: "name", Alias: tests.StrPtr("name"), PathIndex: 1, Kind: "field"},
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
		expectedDocs: []tests.ExpectedDocument{
			{
				Name: "TestQueryInline",
				Kind: "query",
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "user",
						Alias:     tests.StrPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Children: []tests.ExpectedSelection{
							{
								FieldName: "User",
								Alias:     nil,
								PathIndex: 0,
								Kind:      "inline_fragment",
								Children: []tests.ExpectedSelection{
									{FieldName: "id", Alias: tests.StrPtr("id"), PathIndex: 0, Kind: "field"},
									{FieldName: "email", Alias: tests.StrPtr("email"), PathIndex: 1, Kind: "field"},
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
		expectedDocs: []tests.ExpectedDocument{
			{
				Name: "TestQueryDirective",
				Kind: "query",
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "user",
						Alias:     tests.StrPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []tests.ExpectedArgument{
							{Name: "id", Value: "\"123\""},
						},
						Directives: []tests.ExpectedDirective{
							{
								Name: "include",
								Arguments: []tests.ExpectedDirectiveArgument{
									{Name: "if", Value: "true"},
								},
							},
						},
						Children: []tests.ExpectedSelection{
							{FieldName: "id", Alias: tests.StrPtr("id"), PathIndex: 0, Kind: "field"},
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
		expectedDocs: []tests.ExpectedDocument{
			{
				Name: "TestQueryAlias",
				Kind: "query",
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "userById",
						Alias:     tests.StrPtr("u"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []tests.ExpectedArgument{
							{Name: "id", Value: "\"123\""},
						},
						Children: []tests.ExpectedSelection{
							{FieldName: "name", Alias: tests.StrPtr("fn"), PathIndex: 0, Kind: "field"},
							{FieldName: "age", Alias: tests.StrPtr("age"), PathIndex: 1, Kind: "field"},
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
		expectedDocs: []tests.ExpectedDocument{
			{
				Name: "TestQueryDefault",
				Kind: "query",
				Variables: []tests.ExpectedOperationVariable{
					{
						Document:     1,
						VarName:      "limit",
						Type:         "Int",
						DefaultValue: tests.StrPtr("10"),
					},
				},
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "users",
						Alias:     tests.StrPtr("users"),
						PathIndex: 0,
						Kind:      "field",
						Children: []tests.ExpectedSelection{
							{FieldName: "id", Alias: tests.StrPtr("id"), PathIndex: 0, Kind: "field"},
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
		expectedDocs: []tests.ExpectedDocument{
			{
				Name: "TestQueryMultiDirective",
				Kind: "query",
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "user",
						Alias:     tests.StrPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []tests.ExpectedArgument{
							{Name: "id", Value: "\"123\""},
						},
						Directives: []tests.ExpectedDirective{
							{
								Name: "include",
								Arguments: []tests.ExpectedDirectiveArgument{
									{Name: "if", Value: "true"},
								},
							},
							{
								Name: "deprecated",
								Arguments: []tests.ExpectedDirectiveArgument{
									{Name: "reason", Value: "\"old field\""},
								},
							},
						},
						Children: []tests.ExpectedSelection{
							{FieldName: "id", Alias: tests.StrPtr("id"), PathIndex: 0, Kind: "field"},
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
		expectedDocs: []tests.ExpectedDocument{
			{
				Name: "TestMutation",
				Kind: "mutation",
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "updateUser",
						Alias:     tests.StrPtr("updateUser"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []tests.ExpectedArgument{
							{Name: "id", Value: "\"123\""},
							{Name: "name", Value: "\"NewName\""},
						},
						Children: []tests.ExpectedSelection{
							{FieldName: "id", Alias: tests.StrPtr("id"), PathIndex: 0, Kind: "field"},
							{FieldName: "name", Alias: tests.StrPtr("name"), PathIndex: 1, Kind: "field"},
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
		expectedDocs: []tests.ExpectedDocument{
			{
				Name: "TestSubscription",
				Kind: "subscription",
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "userUpdated",
						Alias:     tests.StrPtr("userUpdated"),
						PathIndex: 0,
						Kind:      "field",
						Children: []tests.ExpectedSelection{
							{FieldName: "id", Alias: tests.StrPtr("id"), PathIndex: 0, Kind: "field"},
							{FieldName: "email", Alias: tests.StrPtr("email"), PathIndex: 1, Kind: "field"},
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
		expectedDocs: []tests.ExpectedDocument{
			{
				Name: "TestDeepInline",
				Kind: "query",
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "user",
						Alias:     tests.StrPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []tests.ExpectedArgument{
							{Name: "id", Value: "\"123\""},
						},
						Children: []tests.ExpectedSelection{
							{
								FieldName: "User",
								Alias:     nil,
								PathIndex: 0,
								Kind:      "inline_fragment",
								Children: []tests.ExpectedSelection{
									{
										FieldName: "profile",
										Alias:     tests.StrPtr("details"),
										PathIndex: 0,
										Kind:      "field",
										Children: []tests.ExpectedSelection{
											{FieldName: "bio", Alias: tests.StrPtr("bio"), PathIndex: 0, Kind: "field"},
											{
												FieldName: "Profile",
												Alias:     nil,
												PathIndex: 1,
												Kind:      "inline_fragment",
												Children: []tests.ExpectedSelection{
													{FieldName: "picture", Alias: tests.StrPtr("picture"), PathIndex: 0, Kind: "field"},
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
		expectedDocs: []tests.ExpectedDocument{
			{
				Name: "TestNamedFragment",
				Kind: "query",
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "user",
						Alias:     tests.StrPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []tests.ExpectedArgument{
							{Name: "id", Value: "\"123\""},
						},
						Children: []tests.ExpectedSelection{
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
				TypeCondition: tests.StrPtr("User"),
				Selections: []tests.ExpectedSelection{
					{FieldName: "id", Alias: tests.StrPtr("id"), PathIndex: 0, Kind: "field"},
					{FieldName: "name", Alias: tests.StrPtr("name"), PathIndex: 1, Kind: "field"},
					{FieldName: "email", Alias: tests.StrPtr("email"), PathIndex: 2, Kind: "field"},
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
		expectedDocs: []tests.ExpectedDocument{
			{
				Name: "FirstOperation",
				Kind: "query",
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "user",
						Alias:     tests.StrPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Children: []tests.ExpectedSelection{
							{FieldName: "id", Alias: tests.StrPtr("id"), PathIndex: 0, Kind: "field"},
						},
					},
				},
			},
			{
				Name: "SecondOperation",
				Kind: "query",
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "user",
						Alias:     tests.StrPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Children: []tests.ExpectedSelection{
							{FieldName: "name", Alias: tests.StrPtr("name"), PathIndex: 0, Kind: "field"},
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
		name: "variables in directives",
		rawQuery: `
            query TestVariableDirective($show: Boolean!) {
                user(id: "123") @include(if: $show) {
                    id
                }
            }
        `,
		expectedDocs: []tests.ExpectedDocument{
			{
				Name: "TestVariableDirective",
				Kind: "query",
				Variables: []tests.ExpectedOperationVariable{
					{Document: 1, VarName: "show", Type: "Boolean", TypeModifiers: "!", DefaultValue: nil},
				},
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "user",
						Alias:     tests.StrPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []tests.ExpectedArgument{
							{Name: "id", Value: "\"123\""},
						},
						Directives: []tests.ExpectedDirective{
							{
								Name: "include",
								Arguments: []tests.ExpectedDirectiveArgument{
									{Name: "if", Value: "$show"},
								},
							},
						},
						Children: []tests.ExpectedSelection{
							{FieldName: "id", Alias: tests.StrPtr("id"), PathIndex: 0, Kind: "field"},
						},
					},
				},
			},
		},
	},
	{
		name: "variables in fragments",
		rawQuery: `
            fragment TestFragmentArguments on Query @arguments(show: {type: "Boolean!", defaultValue: true}) {
                user(id: "123") @include(if: $show) {
                    id
                }
            }
        `,
		expectedDocs: []tests.ExpectedDocument{
			{
				Name:          "TestFragmentArguments",
				Kind:          "fragment",
				TypeCondition: tests.StrPtr("Query"),
				Variables: []tests.ExpectedOperationVariable{
					{Document: 1, VarName: "show", Type: "Boolean", TypeModifiers: "!", DefaultValue: nil},
				},
				Directives: []tests.ExpectedDirective{
					{
						Name: "arguments",
						Arguments: []tests.ExpectedDirectiveArgument{
							{Name: "show", Value: "{type:\"Boolean!\",defaultValue:true}"},
						},
					},
				},
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "user",
						Alias:     tests.StrPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []tests.ExpectedArgument{
							{Name: "id", Value: "\"123\""},
						},
						Directives: []tests.ExpectedDirective{
							{
								Name: "include",
								Arguments: []tests.ExpectedDirectiveArgument{
									{Name: "if", Value: "$show"},
								},
							},
						},
						Children: []tests.ExpectedSelection{
							{FieldName: "id", Alias: tests.StrPtr("id"), PathIndex: 0, Kind: "field"},
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
		expectedDocs: []tests.ExpectedDocument{
			{
				Name: "TestIntrospection",
				Kind: "query",
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "user",
						Alias:     tests.StrPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Children: []tests.ExpectedSelection{
							{FieldName: "__typename", Alias: tests.StrPtr("__typename"), PathIndex: 0, Kind: "field"},
							{FieldName: "id", Alias: tests.StrPtr("id"), PathIndex: 1, Kind: "field"},
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
		expectedDocs: []tests.ExpectedDocument{
			{
				Name: "TestInterface",
				Kind: "query",
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "search",
						Alias:     tests.StrPtr("search"),
						PathIndex: 0,
						Kind:      "field",
						Children: []tests.ExpectedSelection{
							{
								FieldName: "Node",
								Alias:     nil,
								PathIndex: 0,
								Kind:      "inline_fragment",
								Children: []tests.ExpectedSelection{
									{FieldName: "id", Alias: tests.StrPtr("id"), PathIndex: 0, Kind: "field"},
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
		expectedDocs: []tests.ExpectedDocument{
			{
				Name: "TestDeprecated",
				Kind: "query",
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "user",
						Alias:     tests.StrPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Children: []tests.ExpectedSelection{
							{
								FieldName: "oldField",
								Alias:     tests.StrPtr("oldField"),
								PathIndex: 0,
								Kind:      "field",
								Directives: []tests.ExpectedDirective{
									{
										Name: "deprecated",
										Arguments: []tests.ExpectedDirectiveArgument{
											{Name: "reason", Value: "\"Use newField\""},
										},
									},
								},
							},
							{
								FieldName: "newField",
								Alias:     tests.StrPtr("newField"),
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
		expectedDocs: []tests.ExpectedDocument{
			{
				Name:          "TestFragmentDirective",
				Kind:          "fragment",
				TypeCondition: tests.StrPtr("User"),
				Directives: []tests.ExpectedDirective{
					{
						Name: "deprecated",
						Arguments: []tests.ExpectedDirectiveArgument{
							{Name: "reason", Value: "\"old fragment\""},
						},
					},
				},
				Selections: []tests.ExpectedSelection{
					{FieldName: "id", Alias: tests.StrPtr("id"), PathIndex: 0, Kind: "field"},
					{FieldName: "email", Alias: tests.StrPtr("email"), PathIndex: 1, Kind: "field"},
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
		expectedDocs: []tests.ExpectedDocument{
			{
				Name: "TestCycle",
				Kind: "query",
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "user",
						Alias:     tests.StrPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Children: []tests.ExpectedSelection{
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
				TypeCondition: tests.StrPtr("User"),
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "B",
						Alias:     nil,
						PathIndex: 0,
						Kind:      "fragment",
					},
					{
						FieldName: "name",
						Alias:     tests.StrPtr("name"),
						PathIndex: 1,
						Kind:      "field",
					},
				},
			},
			{
				Name:          "B",
				Kind:          "fragment",
				TypeCondition: tests.StrPtr("User"),
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "A",
						Alias:     nil,
						PathIndex: 0,
						Kind:      "fragment",
					},
					{
						FieldName: "id",
						Alias:     tests.StrPtr("id"),
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
		inlineComponentFieldProp: tests.StrPtr("user"),
		expectedDocs: []tests.ExpectedDocument{
			{
				Name:          schema.ComponentFieldFragmentName("User", "Avatar"),
				Kind:          "fragment",
				TypeCondition: tests.StrPtr("User"),
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "avatar",
						Alias:     tests.StrPtr("avatar"),
						PathIndex: 0,
						Kind:      "field",
					},
				},
				Directives: []tests.ExpectedDirective{
					{
						Name: "componentField",
						Arguments: []tests.ExpectedDirectiveArgument{
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
		inlineComponentFieldProp: tests.StrPtr("user"),
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
		expectedDocs: []tests.ExpectedDocument{
			{
				Name: "TestComplexDefault",
				Kind: "query",
				Variables: []tests.ExpectedOperationVariable{
					{
						Document:     1,
						VarName:      "filter",
						Type:         "FilterInput",
						DefaultValue: tests.StrPtr("{term:\"foo\",tags:[\"bar\",\"baz\"]}"),
					},
				},
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "search",
						Alias:     tests.StrPtr("search"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []tests.ExpectedArgument{
							{Name: "filter", Value: "$filter"},
						},
						Children: []tests.ExpectedSelection{
							{
								FieldName: "results",
								Alias:     tests.StrPtr("results"),
								PathIndex: 0,
								Kind:      "field",
								Children: []tests.ExpectedSelection{
									{
										FieldName: "id",
										Alias:     tests.StrPtr("id"),
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
		expectedDocs: []tests.ExpectedDocument{
			{
				// This is the operation document for the query.
				Name: "TestInlineDirectives",
				Kind: "query",
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "user",
						Alias:     tests.StrPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []tests.ExpectedArgument{
							{Name: "id", Value: "\"123\""},
						},
						Children: []tests.ExpectedSelection{
							{
								FieldName: "User",
								Alias:     nil,
								PathIndex: 0,
								Kind:      "inline_fragment",
								Directives: []tests.ExpectedDirective{
									{
										Name: "include",
										Arguments: []tests.ExpectedDirectiveArgument{
											{Name: "if", Value: "true"},
										},
									},
								},
								Children: []tests.ExpectedSelection{
									{FieldName: "id", Alias: tests.StrPtr("id"), PathIndex: 0, Kind: "field"},
									{
										FieldName: "email",
										Alias:     tests.StrPtr("email"),
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
		expectedDocs: []tests.ExpectedDocument{
			{
				Name: "TestOpDirective",
				Kind: "query",
				Directives: []tests.ExpectedDirective{
					{
						Name: "cacheControl",
						Arguments: []tests.ExpectedDirectiveArgument{
							{Name: "maxAge", Value: "60"},
						},
					},
				},
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "user",
						Alias:     tests.StrPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Children: []tests.ExpectedSelection{
							{FieldName: "id", Alias: tests.StrPtr("id"), PathIndex: 0, Kind: "field"},
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
		expectedDocs: []tests.ExpectedDocument{
			{
				Name: "TestOpDirective",
				Kind: "query",
				Variables: []tests.ExpectedOperationVariable{
					{
						Document:     1,
						VarName:      "arg",
						Type:         "String",
						DefaultValue: nil,
						Directives: []tests.ExpectedDirective{
							{
								Name: "cacheControl",
								Arguments: []tests.ExpectedDirectiveArgument{
									{Name: "maxAge", Value: "60"},
								},
							},
						},
					},
				},
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "user",
						Alias:     tests.StrPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Children: []tests.ExpectedSelection{
							{FieldName: "id", Alias: tests.StrPtr("id"), PathIndex: 0, Kind: "field"},
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
		expectedDocs: []tests.ExpectedDocument{
			{
				Name: "TestOpDirectives",
				Kind: "query",
				Directives: []tests.ExpectedDirective{
					{Name: "directive1", Arguments: []tests.ExpectedDirectiveArgument{}},
					{Name: "directive2", Arguments: []tests.ExpectedDirectiveArgument{
						{Name: "arg", Value: "\"value\""},
					}},
				},
				Selections: []tests.ExpectedSelection{
					{
						FieldName: "user",
						Alias:     tests.StrPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Children: []tests.ExpectedSelection{
							{FieldName: "id", Alias: tests.StrPtr("id"), PathIndex: 0, Kind: "field"},
						},
					},
				},
			},
		},
	},
}

func TestAfterExtract_loadsExtractedQueries(t *testing.T) {
	for _, tc := range loadDocumentsTable {
		t.Run(tc.name, func(t *testing.T) {
			// create an in-memory db.
			db, err := plugins.NewPoolInMemory[plugin.PluginConfig]()
			if err != nil {
				t.Fatalf("failed to create in-memory db: %v", err)
			}
			defer db.Close()
			conn, err := db.Take(context.Background())
			require.Nil(t, err)
			defer db.Put(conn)

			if err := tests.WriteHoudiniSchema(conn); err != nil {
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

			insertTypeField, err := conn.Prepare("INSERT INTO type_fields (id, type, parent, name) VALUES ($id, $type, $parent, $name)")
			if err != nil {
				t.Fatalf("failed to prepare type_fields insert: %v", err)
			}
			defer insertTypeField.Finalize()

			for _, tf := range typeFields {
				typeParams := strings.Split(tf.id, ".")
				if err := db.ExecStatement(insertTypeField, map[string]interface{}{
					"id":     tf.id,
					"type":   tf.typ,
					"parent": typeParams[0],
					"name":   typeParams[1],
				}); err != nil {
					t.Fatalf("failed to insert type_field %s: %v", tf.id, err)
				}
			}

			// insert the raw document (assume id becomes 1).
			insertRaw, err := conn.Prepare("insert into raw_documents (content, filepath) values ($content, 'foo')")
			if err != nil {
				t.Fatalf("failed to prepare raw_documents insert: %v", err)
			}
			defer insertRaw.Finalize()
			if err := db.ExecStatement(insertRaw, map[string]interface{}{"content": tc.rawQuery}); err != nil {
				t.Fatalf("failed to insert raw document: %v", err)
			}

			hc := &plugin.HoudiniCore{}
			hc.SetDatabase(db)

			pending := documents.PendingQuery{
				Query:                    tc.rawQuery,
				ID:                       1,
				InlineComponentField:     tc.inlineComponentField,
				InlineComponentFieldProp: tc.inlineComponentFieldProp,
			}

			statements, err, finalize := documents.PrepareDocumentInsertStatements(conn)
			require.Nil(t, err)
			defer finalize()

			pendingErr := documents.LoadPendingQuery(context.Background(), db, conn, pending, statements)
			if tc.expectError {
				if pendingErr == nil {
					t.Fatalf("expected an error for test %q but got none", tc.name)
				}
				// stop further checks when error is expected.
				return
			} else if pendingErr != nil {
				t.Fatalf("loadPendingQuery returned error: %v", pendingErr)
			}

			// make sure we generated what we expected
			tests.ValidateExpectedDocuments(t, db, tc.expectedDocs)
		})
	}
}

// testCase defines a test scenario.
type testCase struct {
	name                     string
	rawQuery                 string
	inlineComponentField     bool
	inlineComponentFieldProp *string
	expectedDocs             []tests.ExpectedDocument
	expectError              bool
}
