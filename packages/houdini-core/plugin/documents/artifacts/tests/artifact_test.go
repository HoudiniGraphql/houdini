package artifact_tests

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

				// merge the selection before we print so we can easily write the tests
				collected, err := artifacts.FlattenSelection(
					context.Background(),
					collectedDocs,
					name,
					true,
					true,
				)
				require.Nil(t, err)

				// merge the selections and update the docs to test against
				collectedDocs[name].Selections = collected
				printed := artifacts.PrintCollectedDocument(collectedDocs[name], true)

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
					"MyQuery": tests.Dedent(`
           	export default {
                "name": "TestQuery",
                "kind": "HoudiniQuery",
                "hash": "8e483259f3d69f416c01b6106c0440fa0f916abb4cadb75273f8226a1ff0a5e2",

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
            };

            "HoudiniHash=4e7afee5e8aa689ee7f58f61f60955769c29fe630b05a32ca2a5d8f61620afe3";
          `),
				},
			},
		},
	})
}
