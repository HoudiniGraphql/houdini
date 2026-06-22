package plugin_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	coreConfig "code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-react/plugin"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
)

func TestValidateRouteVariables(t *testing.T) {
	tests.RunTable(t, tests.Table[coreConfig.PluginConfig, *plugin.HoudiniReact]{
		Schema: `
			type Query {
				node(id: ID!): Node
				search(q: String, first: Int, tags: [String!]): [Node!]
			}
			interface Node { id: ID! }
		`,

		PerformTest: func(t *testing.T, p *plugin.HoudiniReact, test tests.Test[coreConfig.PluginConfig]) {
			err := p.Validate(context.Background())
			if test.Pass {
				if err != nil {
					if list, ok := err.(*plugins.ErrorList); ok && list.Len() > 0 {
						t.Fatal(list.GetItems()[0].Message)
					}
					require.NoError(t, err)
				}
				return
			}

			require.Error(t, err)
			list, ok := err.(*plugins.ErrorList)
			require.True(t, ok, "expected an ErrorList")
			require.Equal(t, plugins.ErrorKindValidation, list.GetItems()[0].Kind)
		},

		Tests: []tests.Test[coreConfig.PluginConfig]{
			{
				Name: "required variable backed by a route segment is allowed",
				Pass: true,
				Input: []string{
					"query Q($id: ID!) {\n\tnode(id: $id) {\n\t\tid\n\t}\n}\n",
				},
				Filepaths: []string{"src/routes/[id]/+page.gql"},
			},
			{
				Name: "nullable non-route variable is allowed (becomes a search param)",
				Pass: true,
				Input: []string{
					"query Q($q: String) {\n\tsearch(q: $q) {\n\t\tid\n\t}\n}\n",
				},
				Filepaths: []string{"src/routes/search/+page.gql"},
			},
			{
				Name: "required variable with a default is allowed",
				Pass: true,
				Input: []string{
					"query Q($first: Int! = 10) {\n\tsearch(first: $first) {\n\t\tid\n\t}\n}\n",
				},
				Filepaths: []string{"src/routes/search/+page.gql"},
			},
			{
				Name: "required non-route variable is rejected",
				Pass: false,
				Input: []string{
					"query Q($q: String!) {\n\tsearch(q: $q) {\n\t\tid\n\t}\n}\n",
				},
				Filepaths: []string{"src/routes/search/+page.gql"},
			},
		},
	})
}

func TestValidateEndpoint(t *testing.T) {
	tests.RunTable(t, tests.Table[coreConfig.PluginConfig, *plugin.HoudiniReact]{
		Schema: `
			type Query {
				node(id: ID!): Node
			}
			type Mutation {
				createUser(name: String!): User
				ping: String
			}
			type User {
				id: ID!
				bestFriend: User
			}
			interface Node { id: ID! }
		`,

		PerformTest: func(t *testing.T, p *plugin.HoudiniReact, test tests.Test[coreConfig.PluginConfig]) {
			err := p.Validate(context.Background())
			if test.Pass {
				if err != nil {
					if list, ok := err.(*plugins.ErrorList); ok && list.Len() > 0 {
						t.Fatal(list.GetItems()[0].Message)
					}
					require.NoError(t, err)
				}
				return
			}

			require.Error(t, err)
			list, ok := err.(*plugins.ErrorList)
			require.True(t, ok, "expected an ErrorList")
			require.Equal(t, plugins.ErrorKindValidation, list.GetItems()[0].Kind)
		},

		Tests: []tests.Test[coreConfig.PluginConfig]{
			{
				Name: "mutation with a valid relative redirect and leaf interpolation path",
				Pass: true,
				Input: []string{
					`mutation CreateUser($name: String!) @endpoint(redirect: "/users/{ createUser.id }") {
						createUser(name: $name) { id }
					}`,
				},
			},
			{
				Name: "nested leaf interpolation path is allowed",
				Pass: true,
				Input: []string{
					`mutation CreateUser($name: String!) @endpoint(redirect: "/users/{ createUser.bestFriend.id }") {
						createUser(name: $name) { bestFriend { id } }
					}`,
				},
			},
			{
				Name: "@endpoint without a redirect is allowed",
				Pass: true,
				Input: []string{
					`mutation CreateUser($name: String!) @endpoint {
						createUser(name: $name) { id }
					}`,
				},
			},
			{
				Name: "@endpoint on a query is rejected",
				Pass: false,
				Input: []string{
					`query Whoami @endpoint {
						node(id: "1") { id }
					}`,
				},
			},
			{
				Name: "redirect with an absolute URL is rejected",
				Pass: false,
				Input: []string{
					`mutation CreateUser($name: String!) @endpoint(redirect: "https://evil.com/users") {
						createUser(name: $name) { id }
					}`,
				},
			},
			{
				Name: "redirect with a protocol-relative URL is rejected",
				Pass: false,
				Input: []string{
					`mutation CreateUser($name: String!) @endpoint(redirect: "//evil.com/users") {
						createUser(name: $name) { id }
					}`,
				},
			},
			{
				Name: "redirect without a leading slash is rejected",
				Pass: false,
				Input: []string{
					`mutation CreateUser($name: String!) @endpoint(redirect: "users/new") {
						createUser(name: $name) { id }
					}`,
				},
			},
			{
				Name: "redirect interpolation path missing from the selection set is rejected",
				Pass: false,
				Input: []string{
					`mutation CreateUser($name: String!) @endpoint(redirect: "/users/{ createUser.email }") {
						createUser(name: $name) { id }
					}`,
				},
			},
			{
				Name: "redirect interpolation path resolving to an object is rejected",
				Pass: false,
				Input: []string{
					`mutation CreateUser($name: String!) @endpoint(redirect: "/users/{ createUser.bestFriend }") {
						createUser(name: $name) { bestFriend { id } }
					}`,
				},
			},
		},
	})
}
