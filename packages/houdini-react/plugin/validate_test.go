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
