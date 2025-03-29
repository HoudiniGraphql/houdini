package selection_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"zombiezen.com/go/sqlite"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents/selection"
	"code.houdinigraphql.com/plugins/tests"
)

func TestDocumentCollectAndPrint(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig]{
		Schema: `
      type Query {
        user: User!
        node(id: ID!): Node
      } 

      interface Node {
        id: ID!
      }

      type User implements Node {
        id: ID!
        pets(name: String!, filter: PetFilter ): [Pet!]!
      }

      type Cat implements Node {
        id: ID!
      }

      input PetFilter {
        age_gt: Int
      }

      directive @testDirective(if: Boolean) on ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION

      directive @test on ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION

      union Pet = Cat

    `,
		PerformTest: func(t *testing.T, p *plugin.HoudiniCore, test tests.Test[config.PluginConfig]) {
			// load the documents into the database
			err := p.AfterExtract(context.Background())
			if err != nil {
				require.False(t, test.Pass, err.Error())
				return
			}

			search := "SELECT id FROM documents WHERE name = $name"

			// the extra test content defines what we should expect
			for name, c := range test.Extra {
				content := c.(string)

				// look up the id of the document with the matching name
				var documentID int64
				p.DB.StepQuery(
					context.Background(),
					search,
					map[string]any{"name": name},
					func(q *sqlite.Stmt) {
						documentID = q.GetInt64("id")
					},
				)

				conn, err := p.DB.Take(context.Background())
				require.Nil(t, err)
				defer p.DB.Put(conn)

				statements, err := selection.PreparePrintStatements(conn, 1)
				require.Nil(t, err)
				defer statements.Finalize()

				// print the document we found
				printed, err := selection.PrintDocument(
					context.Background(),
					conn,
					documentID,
					statements,
				)
				require.Nil(t, err)
				require.Equal(t, content, printed)
			}
		},
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "Query with variable directive",
				Input: []string{
					`
            query MyQuery($foo: PetFilter = {age_gt: 123} @testDirective(if: true) @test) { 
              user { 
                id
              } 
            }
          `,
				},
				Extra: map[string]any{
					"MyQuery": tests.Dedent(`
            query MyQuery($foo: PetFilter = {age_gt: 123} @testDirective(if: true) @test) {
              user {
                id 
              }
            }
          `),
				},
			},
		},
	})
}
