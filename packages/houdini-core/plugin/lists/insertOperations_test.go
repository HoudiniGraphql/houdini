package lists_test

import (
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins/tests"
)

func TestInsertOperationInput(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig]{
		Schema: `
			type Query {
				users(limit: Int, offset: Int): [User!]!
			}

			type User {
				id: ID!
				firstName: String!
			}
		`,
		Tests: []tests.Test[config.PluginConfig]{
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
					tests.ExpectedDoc(`
						query AllUsers {
							users @list(name: "All_Users") {
								firstName
								__typename
								id
							}
						}
					`),
					tests.ExpectedDoc(`
						fragment All_Users_insert on User {
							firstName
							id
							__typename
						}
					`),
					tests.ExpectedDoc(`
						fragment All_Users_remove on User {
							__typename
							id
						}
					`),
					tests.ExpectedDoc(`
						fragment All_Users_toggle on User {
							firstName
							id
							__typename
						}
					`),
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
					tests.ExpectedDoc(`
						query AllUsers($limit: Int = 10, $offset: Int) @dedupe(match: Variables) {
							users(limit: $limit, offset: $offset) @paginate(name: "All_Users") {
								firstName
								__typename
								id
							}
						}
					`),
					tests.ExpectedDoc(`
						fragment All_Users_insert on User {
							firstName
							id
							__typename
						}
					`),
					tests.ExpectedDoc(`
						fragment All_Users_remove on User {
							id
							__typename
						}
					`),
					tests.ExpectedDoc(`
						fragment All_Users_toggle on User {
							firstName
							id
							__typename
						}
					`),
				},
			},
		},
	})
}
