package artifacts_test

import (
	"context"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/plugins/tests"
)

// Production codegen runs with sortKeys off, and every other artifact test runs with it on,
// which hides any output built by ranging over a Go map. Go randomizes map order per range,
// so regenerating a few times is enough to catch an unsorted loop.
func TestArtifactsAreDeterministicWithoutSortKeys(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniCore]{
		Schema: `
      enum Color { RED GREEN BLUE }
      enum Size { SMALL MEDIUM LARGE }

      input UserFilter {
        name: String
        email: String
        age: Int
        active: Boolean
        color: Color
        size: Size
      }

      input PageInput {
        first: Int
        after: String
        last: Int
        before: String
        filter: UserFilter
      }

      interface Node { id: ID! }

      type User implements Node { id: ID!, name: String! }
      type Team implements Node { id: ID!, name: String! }
      type Org implements Node { id: ID!, name: String! }
      type Bot implements Node { id: ID!, name: String! }
      type Group implements Node { id: ID!, name: String! }

      union SearchResult = User | Team | Org | Bot | Group

      type Query {
        search(filter: UserFilter, page: PageInput, color: Color, size: Size): [SearchResult!]!
      }
    `,
		PerformTest: func(t *testing.T, p *plugin.HoudiniCore, test tests.Test[config.PluginConfig]) {
			require.NoError(t, p.AfterExtract(context.Background()))
			require.NoError(t, p.Validate(context.Background()))
			require.NoError(t, p.AfterValidate(context.Background()))

			projectConfig, err := p.DB.ProjectConfig(context.Background())
			require.NoError(t, err)
			artifactPath := projectConfig.ArtifactPath("Search")

			var first string
			for range 20 {
				_, err := documents.Generate(context.Background(), p.DB, p.Fs, false)
				require.NoError(t, err)

				content, err := afero.ReadFile(p.Fs, artifactPath)
				require.NoError(t, err)
				if first == "" {
					first = string(content)
					continue
				}
				require.Equal(t, first, string(content))
			}
		},
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "input types, enums, and an abstract type map",
				Pass: true,
				Input: []string{
					`
            query Search($filter: UserFilter, $page: PageInput, $color: Color, $size: Size) {
              search(filter: $filter, page: $page, color: $color, size: $size) {
                ... on Node { id }
                ... on User { name }
              }
            }
          `,
				},
			},
		},
	})
}
