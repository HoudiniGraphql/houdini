package documents_test

import (
	"testing"

	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
)

func TestAddFields(t *testing.T) {
	tests.RunTable(t, tests.Table{
		ProjectConfig: plugins.ProjectConfig{
			TypeConfig: map[string]plugins.TypeConfig{
				"Ghost": {
					Keys: []string{"aka", "name"},
				},
			},
		},
		Schema: `
			type Query {
				user: User
				legends: [Legend]
				ghost: Ghost
				entities: [Entity]
				users(first: Int, after: String): UserConnection!
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
				Name: "Adds ids to selection sets of objects with them",
				Input: []string{
					`
						query Friends {
							user {
								firstName
							}
						}
					`,
				},
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
				Input: []string{`
					query Friends {
						legends {
							name
						}
					}
				`},
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
				Input: []string{`
					query Friends {
						ghost {
							name
						}
					}
				`},
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
				Input: []string{`
					query Friends {
						entities {
							... on User {
								firstName
							}
						}
					}
				`},
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
				Name: "Add connection info to lists",
				Input: []string{`
					query UserList {
						users(first: 10) @paginate(name: "Foo"){
							edges {
								node {
									id
								}
							}
						}
					}
				`},
				Expected: []tests.ExpectedDocument{
					{
						Name: "UserList",
						Kind: "query",
						Selections: []tests.ExpectedSelection{
							{
								FieldName: "users",
								Alias:     tests.StrPtr("users"),
								Kind:      "field",
								Arguments: []tests.ExpectedArgument{
									{
										Name: "first",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Int",
											Raw:  "10",
										},
									},
								},
								Directives: []tests.ExpectedDirective{
									{
										Name: "paginate",
										Arguments: []tests.ExpectedDirectiveArgument{
											{
												Name: "name",
												Value: &tests.ExpectedArgumentValue{
													Kind: "String",
													Raw:  "Foo",
												},
											},
										},
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
														FieldName: "id",
														Alias:     tests.StrPtr("id"),
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
		},
	})
}
