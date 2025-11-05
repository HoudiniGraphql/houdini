package documents_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"zombiezen.com/go/sqlite"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
)

func TestDocumentDependencies(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniCore]{
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
				Extra: map[string]any{
					"getUsers": []string{"UserInfo", "MoreInfo"},
					"UserInfo": []string{"MoreInfo"},
				},
			},
			{
				Name: "No duplicate dependencies with multiple references",
				Pass: true,
				Input: []string{
					`
            fragment SharedFragment on User {
              name
            }
          `,
					`
            query FirstQuery {
              users {
                ...SharedFragment
              }
            }
          `,
					`
            query SecondQuery {
              users {
                ...SharedFragment
              }
            }
          `,
					`
            fragment AnotherFragment on User {
              name
              ...SharedFragment
            }
          `,
				},
				Extra: map[string]any{
					"FirstQuery":      []string{"SharedFragment"},
					"SecondQuery":     []string{"SharedFragment"},
					"AnotherFragment": []string{"SharedFragment"},
				},
			},
			{
				Name: "Multiple dependency loading runs should not create duplicates",
				Pass: true,
				Input: []string{
					`
            fragment TestFragment on User {
              name
            }
          `,
					`
            query TestQuery {
              users {
                ...TestFragment
              }
            }
          `,
				},
				Extra: map[string]any{
					"TestQuery": []string{"TestFragment"},
				},
			},
		},
		VerifyTest: func(
			t *testing.T,
			p *plugin.HoudiniCore,
			test tests.Test[config.PluginConfig],
		) {
			switch test.Name {
			case "Multiple dependency loading runs should not create duplicates":
				// Run LoadDocumentDependencies multiple times to test for duplicates
				// The INSERT OR IGNORE with UNIQUE constraint should prevent duplicates
				for i := 0; i < 3; i++ {
					errs := &plugins.ErrorList{}
					documents.LoadDocumentDependencies(context.Background(), p.DB, errs)
					require.Equal(
						t,
						0,
						errs.Len(),
						"LoadDocumentDependencies should not produce errors on run %d",
						i+1,
					)
				}
			}

			for document, docNames := range test.Extra {
				docs := docNames.([]string)
				// search for the rows encoding the dependency
				query := `
            SELECT documents.name as name, document_dependencies.depends_on, COUNT(*) as count
            FROM document_dependencies
            JOIN documents ON document_dependencies.document = documents.id
            WHERE documents.name = $document
            GROUP BY documents.name, document_dependencies.depends_on
          `

				foundDependsOn := map[string]int{}

				err := p.DB.StepQuery(
					context.Background(),
					query,
					map[string]any{"document": document},
					func(q *sqlite.Stmt) {
						dependsOnName := q.GetText("depends_on")
						count := int(q.GetInt64("count"))
						foundDependsOn[dependsOnName] = count
					})
				require.Nil(t, err)

				// Verify we have the expected number of dependencies
				require.Len(t, foundDependsOn, len(docs))

				// Verify each expected dependency exists and appears exactly once
				for _, doc := range docs {
					count, exists := foundDependsOn[doc]
					require.True(
						t,
						exists,
						"Expected dependency %s for document %s not found",
						doc,
						document,
					)
					require.Equal(
						t,
						1,
						count,
						"Dependency %s for document %s appears %d times, expected exactly 1",
						doc,
						document,
						count,
					)
				}
			}

			// Additional test: verify no duplicate dependencies exist across the entire table
			duplicateQuery := `
          SELECT
            d1.name as document_name,
            dd.depends_on,
            COUNT(*) as count
          FROM document_dependencies dd
          JOIN documents d1 ON dd.document = d1.id
          GROUP BY dd.document, dd.depends_on
          HAVING COUNT(*) > 1
        `

			duplicates := []string{}
			err := p.DB.StepQuery(
				context.Background(),
				duplicateQuery,
				nil,
				func(q *sqlite.Stmt) {
					documentName := q.GetText("document_name")
					dependsOn := q.GetText("depends_on")
					count := q.GetInt64("count")
					duplicates = append(
						duplicates,
						fmt.Sprintf(
							"Document '%s' depends on '%s' %d times",
							documentName,
							dependsOn,
							count,
						),
					)
				})
			require.Nil(t, err)
			require.Empty(t, duplicates, "Found duplicate dependencies: %v", duplicates)
		},
	})
}
