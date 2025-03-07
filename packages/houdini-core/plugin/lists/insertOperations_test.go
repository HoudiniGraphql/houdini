package lists_test

import (
	"testing"

	"code.houdinigraphql.com/plugins/tests"
)

func TestInsertOperationInput(t *testing.T) {
	tests.RunTable(t, tests.Table{
		Schema: `
			type Query {
				users(limit: Int, offset: Int): [User!]!
			}

			type User {
				id: ID!
				firstName: String!
			}
		`,
		Tests: []tests.Test{
			{
				Name: "Operation fragments",
				Pass: true,
				Input: []string{
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
					{
						Name:          "All_Users_insert",
						Kind:          "fragment",
						TypeCondition: tests.StrPtr("User"),
						Selections: []tests.ExpectedSelection{
							{
								FieldName: "firstName",
								Alias:     tests.StrPtr("firstName"),
								Kind:      "field",
							},
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
						},
					},
					{
						Name:          "All_Users_remove",
						Kind:          "fragment",
						TypeCondition: tests.StrPtr("User"),
						Selections: []tests.ExpectedSelection{
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
						Name:          "All_Users_toggle",
						Kind:          "fragment",
						TypeCondition: tests.StrPtr("User"),
						Selections: []tests.ExpectedSelection{
							{
								FieldName: "firstName",
								Alias:     tests.StrPtr("firstName"),
								Kind:      "field",
							},
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
						},
					},
				},
			},
			{
				Name: "Operation fragments from @paginate",
				Pass: true,
				Input: []string{
					`
						query AllUsers {
							users(limit: 10) @paginate(name: "All_Users") {
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
								Arguments: []tests.ExpectedArgument{
									{
										Name: "limit",
										Value: &tests.ExpectedArgumentValue{
											Kind: "Variable",
											Raw:  "limit",
										},
									},
								},
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
								Directives: []tests.ExpectedDirective{
									{
										Name: "paginate",
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
					{
						Name:          "All_Users_insert",
						Kind:          "fragment",
						TypeCondition: tests.StrPtr("User"),
						Selections: []tests.ExpectedSelection{
							{
								FieldName: "firstName",
								Alias:     tests.StrPtr("firstName"),
								Kind:      "field",
							},
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
						},
					},
					{
						Name:          "All_Users_remove",
						Kind:          "fragment",
						TypeCondition: tests.StrPtr("User"),
						Selections: []tests.ExpectedSelection{
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
						Name:          "All_Users_toggle",
						Kind:          "fragment",
						TypeCondition: tests.StrPtr("User"),
						Selections: []tests.ExpectedSelection{
							{
								FieldName: "firstName",
								Alias:     tests.StrPtr("firstName"),
								Kind:      "field",
							},
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
						},
					},
				},
			},
		},
	})
}
