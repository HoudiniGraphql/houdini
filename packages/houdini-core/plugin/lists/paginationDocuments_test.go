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
					tests.ExpectedDoc(`
						query AllUsers($first: Int = 10, $after: String, $before: String, $last: Int) @dedupe(match: Variables) {
							userConnection(first: $first, after: $after,  last: $last, before: $before) @paginate {
								edges {
									node {
										firstName
										__typename
										id
									}
									cursor
									__typename
								}
								__typename
								pageInfo {
									hasNextPage
									hasPreviousPage
									startCursor
									endCursor
								}
							}
						}
					`),
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
					tests.ExpectedDoc(`
						query AllUsers($first: Int = 10, $after: String) @dedupe(match: Variables) {
							forwardConnection(first: $first, after: $after) @paginate {
								edges {
									node {
										firstName
										__typename
										id
									}
									cursor
									__typename
								}
								__typename
								pageInfo {
									hasNextPage
									hasPreviousPage
									startCursor
									endCursor
								}
							}
						}
					`),
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
					tests.ExpectedDoc(`
						query AllUsers($first: Int, $after: String, $before: String, $last: Int) @dedupe(match: Variables) {
							userConnection(first: $first, after: $after,  last: $last, before: $before) @paginate {
								edges {
									node {
										firstName
										__typename
										id
									}
									cursor
									__typename
								}
								__typename
								pageInfo {
									hasNextPage
									hasPreviousPage
									startCursor
									endCursor
								}
							}
						}
					`),
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
					tests.ExpectedDoc(`
						query AllUsers($last: Int = 10, $first: Int, $after: String, $before: String) @dedupe(match: Variables) {
							userConnection(first: $first, after: $after,  last: $last, before: $before) @paginate {
								edges {
									node {
										firstName
										__typename
										id
									}
									cursor
									__typename
								}
								__typename
								pageInfo {
									hasNextPage
									hasPreviousPage
									startCursor
									endCursor
								}
							}
						}
					`),
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
					tests.ExpectedDoc(`
						query AllUsers($last: Int = 10, $before: String) @dedupe(match: Variables) {
							backwardConnection( last: $last, before: $before) @paginate {
								edges {
									node {
										firstName
										__typename
										id
									}
									cursor
									__typename
								}
								__typename
								pageInfo {
									hasNextPage
									hasPreviousPage
									startCursor
									endCursor
								}
							}
						}
					`),
				},
			},
			{
				Name: "sets default value for last arg",
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
					tests.ExpectedDoc(`
						query AllUsers($first: Int, $before: String = "cursor", $after: String, $last: Int = 10) @dedupe(match: Variables) {
							userConnection(first: $first, after: $after,  last: $last, before: $before) @paginate {
								edges {
									node {
										firstName
										__typename
										id
									}
									cursor
									__typename
								}
								__typename
								pageInfo {
									hasNextPage
									hasPreviousPage
									startCursor
									endCursor
								}
							}
						}
					`),
				},
			},
			{
				Name: "sets default value for first arg",
				Pass: true,
				Input: []string{
					`
						query AllUsers {
							userConnection(first: 10, after: "cursor") @paginate {
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
					tests.ExpectedDoc(`
						query AllUsers($first: Int = 10, $after: String = "cursor", $before: String, $last: Int ) @dedupe(match: Variables) {
							userConnection(first: $first, after: $after,  last: $last, before: $before) @paginate {
								edges {
									node {
										firstName
										__typename
										id
									}
									cursor
									__typename
								}
								__typename
								pageInfo {
									hasNextPage
									hasPreviousPage
									startCursor
									endCursor
								}
							}
						}
					`),
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
					tests.ExpectedDoc(`
						query AllUsers($first: Int = 10, $after: String, $before: String, $last: Int ) {
							userConnection(first: $first, after: $after,  last: $last, before: $before) @paginate {
								edges {
									node {
										firstName
										__typename
										id
									}
									cursor
									__typename
								}
								__typename
								pageInfo {
									hasNextPage
									hasPreviousPage
									startCursor
									endCursor
								}
							}
						}
					`),
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
