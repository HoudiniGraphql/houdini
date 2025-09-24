package documents_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"zombiezen.com/go/sqlite"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins/tests"
)

func TestDocumentDependencies(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig]{
		Schema: `
      type Query { 
          users: [User!]!
      }

      type User { 
        name: String!
      }
    `,
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "Register document dependencies",
				Pass: true,
				Input: []string{
					`
            fragment UserInfo on User { 
              name
              ...MoreInfo
            }
          `,
					`
            query getUsers {
              users { 
                ...UserInfo
                ...MoreInfo
              }
            }
          `,
					`
            fragment MoreInfo on User { 
              name
            }
          `,
				},
			},
		},
		VerifyTest: func(
			t *testing.T,
			p *plugin.HoudiniCore,
			test tests.Test[config.PluginConfig],
		) {
			// the only thing we need to verify is that we have registered the dependencies correctly
			dependencies := map[string][]string{
				"getUsers": {"UserInfo", "MoreInfo"},
				"UserInfo": {"MoreInfo"},
			}

			for document, dependsOn := range dependencies {
				// search for the rows encoding the dependency
				query := `
            SELECT documents.name as name, document_dependencies.depends_on
            FROM document_dependencies
            JOIN documents ON document_dependencies.document = documents.id
            WHERE documents.name = $document
          `

				foundDependsOn := map[string]bool{}

				err := p.DB.StepQuery(
					context.Background(),
					query,
					map[string]any{"document": document},
					func(q *sqlite.Stmt) {
						foundDependsOn[q.GetText("depends_on")] = true
					})
				require.Nil(t, err)

				require.Len(t, foundDependsOn, len(dependsOn))
				for _, doc := range dependsOn {
					require.True(t, foundDependsOn[doc])
				}
			}
		},
	})
}
