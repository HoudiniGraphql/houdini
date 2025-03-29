package selection_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"zombiezen.com/go/sqlite"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
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
			err := documents.LoadDocuments(context.Background(), p.DB)
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

				// the first thing we have to do is collect the selections
				collected, err := selection.CollectDocuments(context.Background(), p.DB)
				require.Nil(t, err)

				// print the document we found
				err = selection.EnsureDocumentsPrinted(
					context.Background(),
					conn,
					collected,
				)
				require.Nil(t, err)

				// look up the printed document
				statement, err := conn.Prepare(`select printed from documents where ID = $document`)
				p.DB.BindStatement(statement, map[string]any{"document": documentID})
				require.Nil(t, err)
				var printed string
				p.DB.StepStatement(context.Background(), statement, func() {
					printed = statement.GetText("printed")
				})

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
