package artifacts_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents/artifacts"
	"code.houdinigraphql.com/plugins/tests"
)

func TestArtifactGeneration(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig]{
		Schema: `
      type Query {
        friends: [User!]!
        user: User!
        node(id: ID!): Node
        version: Int
      } 

      interface Node {
        id: ID!
      }

      type User implements Node {
        id: ID!
        name: String!
        bestFriend: User! 
        pets(name: String!, filter: PetFilter ): [Pet!]!
      }

      type Cat implements Node {
        id: ID!
        owner: User!
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

			// the extra test content defines what we should expect
			for name, c := range test.Extra {
				content := c.(string)

				conn, err := p.DB.Take(context.Background())
				require.Nil(t, err)
				defer p.DB.Put(conn)

				// the first thing we have to do is collect the artifacts.
				collectedDocs, err := artifacts.CollectDocuments(context.Background(), p.DB, conn)
				require.Nil(t, err)

				//  make sure that the documents are printed
				err = artifacts.EnsureDocumentsPrinted(
					context.Background(),
					p.DB,
					conn,
					collectedDocs,
					false,
				)
				require.Nil(t, err)

				// merge the selection before we print so we can easily write the tests
				selection, err := artifacts.FlattenSelection(
					context.Background(),
					collectedDocs,
					name,
					true,
					true,
				)
				require.Nil(t, err)

				// generate the selection document
				printed, err := artifacts.GenerateSelectionDocument(
					context.Background(),
					p.DB,
					conn,
					collectedDocs,
					name,
					selection,
				)

				require.Equal(t, content, printed)
			}
		},
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "Adds kind, name, raw, response and selection",
				Pass: true,
				Input: []string{
					`
            query TestQuery {
              version
            } 
          `,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`
            export default {
                "name": "TestQuery",
                "kind": "HoudiniQuery",
                "hash": "399380b224f926ada58db369b887cfdce8b0f08f263f27a48eec3d5e832d1777",
                "raw": ` + "`" + `query TestQuery {
                version
            }
            ` + "`" + `,

                "rootType": "Query",
                "stripVariables": [],

                "selection": {
                    "fields": {
                        "version": {
                            "type": "Int",
                            "keyRaw": "version",
                            "visible": true
                        }
                    }
                },

                "pluginData": {},
                "policy": "CacheOrNetwork",
                "partial": false
            }

            "HoudiniHash=399380b224f926ada58db369b887cfdce8b0f08f263f27a48eec3d5e832d1777"
          `),
				},
			},
		},
	})
}
