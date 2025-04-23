package artifacts_test

import (
	"context"
	"path"
	"testing"

	"github.com/spf13/afero"
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
        firstName: String
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

			// generate the artifacts
			err = artifacts.Generate(context.Background(), p.DB, p.Fs, true)
			if err != nil {
				require.False(t, test.Pass, err.Error())
				return
			}

			projectConfig, err := p.DB.ProjectConfig(context.Background())
			if err != nil {
				require.False(t, test.Pass, err.Error())
				return
			}

			// the extra test content defines what we should expect
			for name, c := range test.Extra {
				expected := c.(string)

				// the artifact is located at .houdini/artifacts/<name>.js
				artifactPath := path.Join(
					projectConfig.ProjectRoot,
					projectConfig.RuntimeDir,
					"artifacts",
					name+".js",
				)

				// read the file
				file, err := p.Fs.Open(artifactPath)
				require.Nil(t, err)
				fileContent, err := afero.ReadAll(file)
				require.Nil(t, err)

				// make sure it matches the expected value
				require.Equal(t, expected, string(fileContent))
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
					`
            fragment TestFragment on User { 
              firstName 
              id
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
                            "visible": true,
                        },
                    },
                },

                "pluginData": {},
                "policy": "CacheOrNetwork",
                "partial": false
            }

            "HoudiniHash=399380b224f926ada58db369b887cfdce8b0f08f263f27a48eec3d5e832d1777"
          `),
					"TestFragment": tests.Dedent(`
            export default {
                "name": "TestFragment",
                "kind": "HoudiniFragment",
                "hash": "9291c36c6e30ce6a058424b4a5e1f4191d8214df6109b927677071e60bb134ac",
                "raw": ` + "`" + `fragment TestFragment on User {
                firstName
                id
            }
            ` + "`" + `,

                "rootType": "User",
                "stripVariables": [],

                "selection": {
                    "fields": {
                        "firstName": {
                            "type": "String",
                            "keyRaw": "firstName",
                            "visible": true,
                        },

                        "id": {
                            "type": "ID",
                            "keyRaw": "id",
                            "visible": true,
                        },
                    },
                },

                "pluginData": {},
                "policy": "CacheOrNetwork",
                "partial": false
            }

            "HoudiniHash=9291c36c6e30ce6a058424b4a5e1f4191d8214df6109b927677071e60bb134ac"
          `),
				},
			},
			{
				Name: "Selection includes fragments",
				Pass: true,
				Input: []string{
					`
            query TestQuery {
              user { 
                ...TestFragment
              }
            } 
          `,
					`
            fragment TestFragment on User { 
              firstName 
              id
            }
          `,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`
            export default {
                "name": "TestQuery",
                "kind": "HoudiniQuery",
                "hash": "37cb2d430ff78e36f786c3100d36dc232240d4e469e1a6c7b90874330c6cdcb0",
                "raw": ` + "`" + `fragment TestFragment on User {
                firstName
                id
            }
            
            query TestQuery {
                user {
                    ...TestFragment
                }
            }
            ` + "`" + `,

                "rootType": "Query",
                "stripVariables": [],

                "selection": {
                    "fields": {
                        "user": {
                            "type": "User",
                            "keyRaw": "user",

                            "selection": {
                                "fields": {
                                    "firstName": {
                                        "type": "String",
                                        "keyRaw": "firstName",
                                    },

                                    "id": {
                                        "type": "ID",
                                        "keyRaw": "id",
                                    },
                                },

                                "fragments": {
                                    "TestFragment": {
                                        "arguments": {}
                                    },
                                },
                            },

                            "visible": true,
                        },
                    },
                },

                "pluginData": {},
                "policy": "CacheOrNetwork",
                "partial": false
            }

            "HoudiniHash=37cb2d430ff78e36f786c3100d36dc232240d4e469e1a6c7b90874330c6cdcb0"

          `),
				},
			},
		},
	})
}
