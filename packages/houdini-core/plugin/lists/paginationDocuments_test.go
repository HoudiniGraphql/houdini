package lists_test

import (
	"fmt"
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin/schema"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
)

func TestPaginationDocumentGeneration(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig]{
		Schema: `
			type Query {
				users(limit: Int, offset: Int): [User!]!
				userConnection(first: Int, after: String, last: Int, before: String): UserConnection!
				forwardConnection(first: Int, after: String): UserConnection!
				backwardConnection(last: Int, before: String): UserConnection!
				node(id: ID!): Node
				legend(title: String!): Legend
			}

			type Legend {
				title: String!
				believers(limit: Int, offset: Int): [User!]!
			}

			type User implements Node {
				id: ID!
				firstName: String!
				friends(first:Int, after: String, last: Int, before: String): UserConnection!
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

			interface Node {
				id: ID!
			}
		`,
		Tests: []tests.Test[config.PluginConfig]{
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
			{
				Name: "fragment on query",
				Pass: true,
				Input: []string{
					`
						fragment AllUsers on Query {
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
						fragment AllUsers_c9Zhk on Query {
							userConnection(first: $first, after: $after, last: $last, before: $before) @paginate {
								edges {
									node {
										firstName
										__typename
										id
									}
									__typename
									cursor
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
					tests.ExpectedDoc(
						fmt.Sprintf(`
							query %s($first: Int = 10, $after: String, $before: String, $last: Int ) @dedupe(match: Variables) {
								...AllUsers_c9Zhk @with(first: $first, after: $after, before: $before, last: $last)
							}
						`,
							schema.FragmentPaginationQueryName("AllUsers"),
						)),
				},
			},
			{
				Name: "fragment on node",
				Pass: true,
				Input: []string{
					`
						fragment Friends on User {
							friends(first: 10) @paginate {
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
						fragment Friends_c9Zhk  on User {
              id
              __typename
							friends(first: $first, after: $after, last: $last, before: $before) @paginate {
								edges {
									node {
										firstName
										__typename
										id
									}
									__typename
									cursor
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
					tests.ExpectedDoc(
						fmt.Sprintf(`
							query %s($first: Int = 10, $after: String, $before: String, $last: Int, $id: ID!) @dedupe(match: Variables) {
								node(id: $id) {
									...Friends_c9Zhk @with(first: $first, after: $after, before: $before, last: $last)
								}
							}
						`,
							schema.FragmentPaginationQueryName("Friends"),
						)),
				},
			},
			{
				Name: "fragment on custom resolve query",
				Pass: true,
				Input: []string{
					`
						fragment Believers on Legend {
							believers(limit: 10) @paginate {
								firstName
							}
						}
					`,
				},
				ProjectConfig: func(config *plugins.ProjectConfig) {
					config.TypeConfig["Legend"] = plugins.TypeConfig{
						Keys:         []string{"title"},
						ResolveQuery: "legend",
					}
				},
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(`
						fragment Believers_1uyQEt on Legend {
							believers(limit: $limit, offset: $offset) @paginate {
								firstName
								__typename
								id
							}
              __typename
              title
						}
					`),
					tests.ExpectedDoc(
						fmt.Sprintf(`
							query %s($limit: Int = 10, $offset: Int, $title: String!) @dedupe(match: Variables) {
								legend(title: $title) {
									...Believers_1uyQEt @with(limit: $limit, offset: $offset)
								}
							}
						`,
							schema.FragmentPaginationQueryName("Believers"),
						)),
				},
			},
		},
	})
}
