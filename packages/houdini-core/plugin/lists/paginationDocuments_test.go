package lists_test

import (
	"testing"

	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
)

func TestPaginationDocumentGeneration(t *testing.T) {
	tests.RunTable(t, tests.Table{
		Schema: `
			type Query {
				users(limit: Int, offset: Int): [User!]!
				userConnection(first: Int, after: String, last: Int, before: String): UserConnection!
				forwardConnection(first: Int, after: String): UserConnection!
				backwardConnection(last: Int, before: String): UserConnection!
			}

			type User {
				id: ID!
				firstName: String!
			}

			type UserConnection {
				pageInfo: PageInfo!
				edges: [UserEdge!]!
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
		`,
		Tests: []tests.Test{
			{
				Name: "adds full cursor args to forward bidirectional connection",
				Pass: true,
				Input: []string{
					`
						query AllUsers {
							userConnection(first: 10) @paginate {
								edges {
									node {
										firstName
									}
								}
							}
						}
					`,
				},
				Expected: []tests.ExpectedDocument{
					{
						Name: "AllUsers",
						Kind: "query",
						Variables: []tests.ExpectedOperationVariable{
							{
								Name: "first",
								Type: "Int",
								DefaultValue: &tests.ExpectedArgumentValue{
									Kind: "Int",
									Raw:  "10",
								},
							},
							{
								Name: "after",
								Type: "String",
							},
							{
								Name: "last",
								Type: "Int",
							},
							{
								Name: "before",
								Type: "String",
							},
						},
						Directives: []tests.ExpectedDirective{
							{
								Name: "dedupe",
								Arguments: []tests.ExpectedDirectiveArgument{
									{
										Name: "match",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Enum",
											Raw:  "Variables",
										},
									},
								},
							},
						},
						Selections: []tests.ExpectedSelection{
							{
								FieldName: "userConnection",
								Alias:     tests.StrPtr("userConnection"),
								Kind:      "field",
								Arguments: []tests.ExpectedArgument{
									{
										Name: "first",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "first",
										},
									},
									{
										Name: "after",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "after",
										},
									},
									{
										Name: "last",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "last",
										},
									},
									{
										Name: "before",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "before",
										},
									},
								},
								Directives: []tests.ExpectedDirective{
									{
										Name: "paginate",
									},
								},
								Children: []tests.ExpectedSelection{
									{
										FieldName: "edges",
										Alias:     tests.StrPtr("edges"),
										Kind:      "field",
										Children: []tests.ExpectedSelection{
											{
												FieldName: "node",
												Alias:     tests.StrPtr("node"),
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
											{
												FieldName: "__typename",
												Alias:     tests.StrPtr("__typename"),
												Kind:      "field",
											},
											{
												FieldName: "cursor",
												Alias:     tests.StrPtr("cursor"),
												Kind:      "field",
											},
										},
									},
									{
										FieldName: "__typename",
										Alias:     tests.StrPtr("__typename"),
										Kind:      "field",
									},
									pageInfo,
								},
							},
						},
					},
				},
			},
			{
				Name: "adds partial cursor args to forward connection",
				Pass: true,
				Input: []string{
					`
						query AllUsers {
							forwardConnection(first: 10) @paginate {
								edges {
									node {
										firstName
									}
								}
							}
						}
					`,
				},
				Expected: []tests.ExpectedDocument{
					{
						Name: "AllUsers",
						Kind: "query",
						Variables: []tests.ExpectedOperationVariable{
							{
								Name: "first",
								Type: "Int",
								DefaultValue: &tests.ExpectedArgumentValue{
									Kind: "Int",
									Raw:  "10",
								},
							},
							{
								Name: "after",
								Type: "String",
							},
						},
						Directives: []tests.ExpectedDirective{
							{
								Name: "dedupe",
								Arguments: []tests.ExpectedDirectiveArgument{
									{
										Name: "match",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Enum",
											Raw:  "Variables",
										},
									},
								},
							},
						},
						Selections: []tests.ExpectedSelection{
							{
								FieldName: "forwardConnection",
								Alias:     tests.StrPtr("forwardConnection"),
								Kind:      "field",
								Arguments: []tests.ExpectedArgument{
									{
										Name: "first",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "first",
										},
									},
									{
										Name: "after",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "after",
										},
									},
								},
								Directives: []tests.ExpectedDirective{
									{
										Name: "paginate",
									},
								},
								Children: []tests.ExpectedSelection{
									{
										FieldName: "edges",
										Alias:     tests.StrPtr("edges"),
										Kind:      "field",
										Children: []tests.ExpectedSelection{
											{
												FieldName: "node",
												Alias:     tests.StrPtr("node"),
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
											{
												FieldName: "__typename",
												Alias:     tests.StrPtr("__typename"),
												Kind:      "field",
											},
											{
												FieldName: "cursor",
												Alias:     tests.StrPtr("cursor"),
												Kind:      "field",
											},
										},
									},
									{
										FieldName: "__typename",
										Alias:     tests.StrPtr("__typename"),
										Kind:      "field",
									},
									pageInfo,
								},
							},
						},
					},
				},
			},
			{
				Name: "first arg as variable",
				Pass: true,
				Input: []string{
					`
						query AllUsers($first: Int) {
							userConnection(first: $first) @paginate {
								edges {
									node {
										firstName
									}
								}
							}
						}
					`,
				},
				Expected: []tests.ExpectedDocument{
					{
						Name: "AllUsers",
						Kind: "query",
						Variables: []tests.ExpectedOperationVariable{
							{
								Name: "first",
								Type: "Int",
							},
							{
								Name: "after",
								Type: "String",
							},
							{
								Name: "last",
								Type: "Int",
							},
							{
								Name: "before",
								Type: "String",
							},
						},
						Directives: []tests.ExpectedDirective{
							{
								Name: "dedupe",
								Arguments: []tests.ExpectedDirectiveArgument{
									{
										Name: "match",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Enum",
											Raw:  "Variables",
										},
									},
								},
							},
						},
						Selections: []tests.ExpectedSelection{
							{
								FieldName: "userConnection",
								Alias:     tests.StrPtr("userConnection"),
								Kind:      "field",
								Arguments: []tests.ExpectedArgument{
									{
										Name: "first",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "first",
										},
									},
									{
										Name: "after",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "after",
										},
									},
									{
										Name: "last",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "last",
										},
									},
									{
										Name: "before",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "before",
										},
									},
								},
								Directives: []tests.ExpectedDirective{
									{
										Name: "paginate",
									},
								},
								Children: []tests.ExpectedSelection{
									{
										FieldName: "edges",
										Alias:     tests.StrPtr("edges"),
										Kind:      "field",
										Children: []tests.ExpectedSelection{
											{
												FieldName: "node",
												Alias:     tests.StrPtr("node"),
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
											{
												FieldName: "__typename",
												Alias:     tests.StrPtr("__typename"),
												Kind:      "field",
											},
											{
												FieldName: "cursor",
												Alias:     tests.StrPtr("cursor"),
												Kind:      "field",
											},
										},
									},
									{
										FieldName: "__typename",
										Alias:     tests.StrPtr("__typename"),
										Kind:      "field",
									},
									pageInfo,
								},
							},
						},
					},
				},
			},
			{
				Name: "adds full cursor args to backward bidirectional connection",
				Pass: true,
				Input: []string{
					`
						query AllUsers {
							userConnection(last: 10) @paginate {
								edges {
									node {
										firstName
									}
								}
							}
						}
					`,
				},
				Expected: []tests.ExpectedDocument{
					{
						Name: "AllUsers",
						Kind: "query",
						Variables: []tests.ExpectedOperationVariable{
							{
								Name: "last",
								Type: "Int",
								DefaultValue: &tests.ExpectedArgumentValue{
									Kind: "Int",
									Raw:  "10",
								},
							},
							{
								Name: "before",
								Type: "String",
							},
							{
								Name: "first",
								Type: "Int",
							},
							{
								Name: "after",
								Type: "String",
							},
						},
						Directives: []tests.ExpectedDirective{
							{
								Name: "dedupe",
								Arguments: []tests.ExpectedDirectiveArgument{
									{
										Name: "match",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Enum",
											Raw:  "Variables",
										},
									},
								},
							},
						},
						Selections: []tests.ExpectedSelection{
							{
								FieldName: "userConnection",
								Alias:     tests.StrPtr("userConnection"),
								Kind:      "field",
								Arguments: []tests.ExpectedArgument{
									{
										Name: "last",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "last",
										},
									},
									{
										Name: "before",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "before",
										},
									},
									{
										Name: "first",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "first",
										},
									},
									{
										Name: "after",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "after",
										},
									},
								},
								Directives: []tests.ExpectedDirective{
									{
										Name: "paginate",
									},
								},
								Children: []tests.ExpectedSelection{
									{
										FieldName: "edges",
										Alias:     tests.StrPtr("edges"),
										Kind:      "field",
										Children: []tests.ExpectedSelection{
											{
												FieldName: "node",
												Alias:     tests.StrPtr("node"),
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
											{
												FieldName: "__typename",
												Alias:     tests.StrPtr("__typename"),
												Kind:      "field",
											},
											{
												FieldName: "cursor",
												Alias:     tests.StrPtr("cursor"),
												Kind:      "field",
											},
										},
									},
									{
										FieldName: "__typename",
										Alias:     tests.StrPtr("__typename"),
										Kind:      "field",
									},
									pageInfo,
								},
							},
						},
					},
				},
			},
			{
				Name: "adds partial cursor args to backward connection",
				Pass: true,
				Input: []string{
					`
						query AllUsers {
							backwardConnection(last: 10) @paginate {
								edges {
									node {
										firstName
									}
								}
							}
						}
					`,
				},
				Expected: []tests.ExpectedDocument{
					{
						Name: "AllUsers",
						Kind: "query",
						Variables: []tests.ExpectedOperationVariable{
							{
								Name: "last",
								Type: "Int",
								DefaultValue: &tests.ExpectedArgumentValue{
									Kind: "Int",
									Raw:  "10",
								},
							},
							{
								Name: "before",
								Type: "String",
							},
						},
						Directives: []tests.ExpectedDirective{
							{
								Name: "dedupe",
								Arguments: []tests.ExpectedDirectiveArgument{
									{
										Name: "match",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Enum",
											Raw:  "Variables",
										},
									},
								},
							},
						},
						Selections: []tests.ExpectedSelection{
							{
								FieldName: "backwardConnection",
								Alias:     tests.StrPtr("backwardConnection"),
								Kind:      "field",
								Arguments: []tests.ExpectedArgument{
									{
										Name: "last",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "last",
										},
									},
									{
										Name: "before",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "before",
										},
									},
								},
								Directives: []tests.ExpectedDirective{
									{
										Name: "paginate",
									},
								},
								Children: []tests.ExpectedSelection{
									{
										FieldName: "edges",
										Alias:     tests.StrPtr("edges"),
										Kind:      "field",
										Children: []tests.ExpectedSelection{
											{
												FieldName: "node",
												Alias:     tests.StrPtr("node"),
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
											{
												FieldName: "__typename",
												Alias:     tests.StrPtr("__typename"),
												Kind:      "field",
											},
											{
												FieldName: "cursor",
												Alias:     tests.StrPtr("cursor"),
												Kind:      "field",
											},
										},
									},
									{
										FieldName: "__typename",
										Alias:     tests.StrPtr("__typename"),
										Kind:      "field",
									},
									pageInfo,
								},
							},
						},
					},
				},
			},
			{
				Name: "sets default value for last arg",
				Pass: true,
				Input: []string{
					`
						query AllUsers {
							userConnection(last: 10, after: "cursor") @paginate {
								edges {
									node {
										firstName
									}
								}
							}
						}
					`,
				},
				Expected: []tests.ExpectedDocument{
					{
						Name: "AllUsers",
						Kind: "query",
						Variables: []tests.ExpectedOperationVariable{
							{
								Name: "last",
								Type: "Int",
								DefaultValue: &tests.ExpectedArgumentValue{
									Kind: "Int",
									Raw:  "10",
								},
							},
							{
								Name: "after",
								Type: "String",
								DefaultValue: &tests.ExpectedArgumentValue{
									Kind: "String",
									Raw:  "cursor",
								},
							},
							{
								Name: "first",
								Type: "Int",
							},
							{
								Name: "before",
								Type: "String",
							},
						},
						Directives: []tests.ExpectedDirective{
							{
								Name: "dedupe",
								Arguments: []tests.ExpectedDirectiveArgument{
									{
										Name: "match",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Enum",
											Raw:  "Variables",
										},
									},
								},
							},
						},
						Selections: []tests.ExpectedSelection{
							{
								FieldName: "userConnection",
								Alias:     tests.StrPtr("userConnection"),
								Kind:      "field",
								Arguments: []tests.ExpectedArgument{
									{
										Name: "last",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "last",
										},
									},
									{
										Name: "before",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "before",
										},
									},
									{
										Name: "first",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "first",
										},
									},
									{
										Name: "after",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "after",
										},
									},
								},
								Directives: []tests.ExpectedDirective{
									{
										Name: "paginate",
									},
								},
								Children: []tests.ExpectedSelection{
									{
										FieldName: "edges",
										Alias:     tests.StrPtr("edges"),
										Kind:      "field",
										Children: []tests.ExpectedSelection{
											{
												FieldName: "node",
												Alias:     tests.StrPtr("node"),
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
											{
												FieldName: "__typename",
												Alias:     tests.StrPtr("__typename"),
												Kind:      "field",
											},
											{
												FieldName: "cursor",
												Alias:     tests.StrPtr("cursor"),
												Kind:      "field",
											},
										},
									},
									{
										FieldName: "__typename",
										Alias:     tests.StrPtr("__typename"),
										Kind:      "field",
									},
									pageInfo,
								},
							},
						},
					},
				},
			},
			{
				Name: "sets default value for before arg",
				Pass: true,
				Input: []string{
					`
						query AllUsers {
							userConnection(last: 10, before: "cursor") @paginate {
								edges {
									node {
										firstName
									}
								}
							}
						}
					`,
				},
				Expected: []tests.ExpectedDocument{
					{
						Name: "AllUsers",
						Kind: "query",
						Variables: []tests.ExpectedOperationVariable{
							{
								Name: "last",
								Type: "Int",
								DefaultValue: &tests.ExpectedArgumentValue{
									Kind: "Int",
									Raw:  "10",
								},
							},
							{
								Name: "before",
								Type: "String",
								DefaultValue: &tests.ExpectedArgumentValue{
									Kind: "String",
									Raw:  "cursor",
								},
							},
							{
								Name: "first",
								Type: "Int",
							},
							{
								Name: "after",
								Type: "String",
							},
						},
						Directives: []tests.ExpectedDirective{
							{
								Name: "dedupe",
								Arguments: []tests.ExpectedDirectiveArgument{
									{
										Name: "match",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Enum",
											Raw:  "Variables",
										},
									},
								},
							},
						},
						Selections: []tests.ExpectedSelection{
							{
								FieldName: "userConnection",
								Alias:     tests.StrPtr("userConnection"),
								Kind:      "field",
								Arguments: []tests.ExpectedArgument{
									{
										Name: "last",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "last",
										},
									},
									{
										Name: "before",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "before",
										},
									},
									{
										Name: "first",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "first",
										},
									},
									{
										Name: "after",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "after",
										},
									},
								},
								Directives: []tests.ExpectedDirective{
									{
										Name: "paginate",
									},
								},
								Children: []tests.ExpectedSelection{
									{
										FieldName: "edges",
										Alias:     tests.StrPtr("edges"),
										Kind:      "field",
										Children: []tests.ExpectedSelection{
											{
												FieldName: "node",
												Alias:     tests.StrPtr("node"),
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
											{
												FieldName: "__typename",
												Alias:     tests.StrPtr("__typename"),
												Kind:      "field",
											},
											{
												FieldName: "cursor",
												Alias:     tests.StrPtr("cursor"),
												Kind:      "field",
											},
										},
									},
									{
										FieldName: "__typename",
										Alias:     tests.StrPtr("__typename"),
										Kind:      "field",
									},
									pageInfo,
								},
							},
						},
					},
				},
			},
			{
				Name: "suppress dedupe",
				Pass: true,
				Input: []string{
					`
						query AllUsers {
							userConnection(first: 10) @paginate {
								edges {
									node {
										firstName
									}
								}
							}
						}
					`,
				},
				ProjectConfig: func(config *plugins.ProjectConfig) {
					config.SuppressPaginationDeduplication = true
				},
				Expected: []tests.ExpectedDocument{
					{
						Name: "AllUsers",
						Kind: "query",
						Variables: []tests.ExpectedOperationVariable{
							{
								Name: "first",
								Type: "Int",
								DefaultValue: &tests.ExpectedArgumentValue{
									Kind: "Int",
									Raw:  "10",
								},
							},
							{
								Name: "after",
								Type: "String",
							},
							{
								Name: "last",
								Type: "Int",
							},
							{
								Name: "before",
								Type: "String",
							},
						},
						Selections: []tests.ExpectedSelection{
							{
								FieldName: "userConnection",
								Alias:     tests.StrPtr("userConnection"),
								Kind:      "field",
								Arguments: []tests.ExpectedArgument{
									{
										Name: "first",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "first",
										},
									},
									{
										Name: "after",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "after",
										},
									},
									{
										Name: "last",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "last",
										},
									},
									{
										Name: "before",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "before",
										},
									},
								},
								Directives: []tests.ExpectedDirective{
									{
										Name: "paginate",
									},
								},
								Children: []tests.ExpectedSelection{
									{
										FieldName: "edges",
										Alias:     tests.StrPtr("edges"),
										Kind:      "field",
										Children: []tests.ExpectedSelection{
											{
												FieldName: "node",
												Alias:     tests.StrPtr("node"),
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
											{
												FieldName: "__typename",
												Alias:     tests.StrPtr("__typename"),
												Kind:      "field",
											},
											{
												FieldName: "cursor",
												Alias:     tests.StrPtr("cursor"),
												Kind:      "field",
											},
										},
									},
									{
										FieldName: "__typename",
										Alias:     tests.StrPtr("__typename"),
										Kind:      "field",
									},
									pageInfo,
								},
							},
						},
					},
				},
			},
		},
	})
}

var pageInfo = tests.ExpectedSelection{
	FieldName: "pageInfo",
	Alias:     tests.StrPtr("pageInfo"),
	Kind:      "field",
	Children: []tests.ExpectedSelection{
		{
			FieldName: "hasNextPage",
			Alias:     tests.StrPtr("hasNextPage"),
			Kind:      "field",
		},
		{
			FieldName: "hasPreviousPage",
			Alias:     tests.StrPtr("hasPreviousPage"),
			Kind:      "field",
		},
		{
			FieldName: "startCursor",
			Alias:     tests.StrPtr("startCursor"),
			Kind:      "field",
		},

		{
			FieldName: "endCursor",
			Alias:     tests.StrPtr("endCursor"),
			Kind:      "field",
		},
	},
}
