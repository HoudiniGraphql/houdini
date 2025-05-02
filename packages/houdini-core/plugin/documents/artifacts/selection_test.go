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
			  user(
          id: ID, 
          filter: UserFilter, 
          filterList: [UserFilter!], 
          enumArg: MyEnum
        ): User!
        friends: [Friend!]!
        pets: [Pet!]!
        node(id: ID!): Node
        version: Int!
      } 

      interface Node {
        id: ID!
      }

      type User implements Node & Friend {
        id: ID!
        name: String!
        bestFriend: User! 
        firstName: String!
        friends: [User!]!
        pets(name: String!, filter: PetFilter ): [Pet!]!
      }

      type Cat implements Node & Friend {
        id: ID!
        name: String!
        owner: User!
      }

      type Dog implements Node & Friend {
        id: ID!
        name: String!
      }

      interface Friend {
        name: String!
      }

      input PetFilter {
        age_gt: Int
      }

      directive @testDirective(if: Boolean) on ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION

      directive @test on ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION

      union Pet = Cat

      enum MyEnum {
        Hello
      }

      input UserFilter {
        middle: NestedUserFilter
        listRequired: [String!]!
        nullList: [String]
        recursive: UserFilter
        enum: MyEnum
      }

      input NestedUserFilter {
        id: ID!
        firstName: String!
        admin: Boolean
        age: Int
        weight: Float
      }
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
			{
				Name: "Overlapping selections aren't hidden",
				Pass: true,
				Input: []string{
					`
    query TestQuery {
      user { 
          firstName
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
                  "hash": "68a132637799d1b412ef63cc8365e2552b16e53d0fa5c6409514eea6706ef569",
                  "raw": ` + "`" + `fragment TestFragment on User {
                  firstName
                  id
              }
              
              query TestQuery {
                  user {
                      firstName
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
                                          "visible": true,
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

              "HoudiniHash=68a132637799d1b412ef63cc8365e2552b16e53d0fa5c6409514eea6706ef569"
  `),
				},
			},
			{
				Name: "Interface to interface inline fragment",
				Pass: true,
				Input: []string{
					`
            query MyQuery($id: ID!) {
              node(id: $id) {
                id
                ... on Friend {
                  name
                }
              }
            }
          `,
				},
				Extra: map[string]any{
					"MyQuery": tests.Dedent(`
              export default {
                  "name": "MyQuery",
                  "kind": "HoudiniQuery",
                  "hash": "2bf1a6f13b012901b2017ee8b44c24d39fe7aa0725d68deea5a3e08d7393d671",
                  "raw": ` + "`" + `query MyQuery($id: ID!) {
                  node(id: $id) {
                      id
                      ... on Friend {
                          name
                      }
                  }
              }
              ` + "`" + `,

                  "rootType": "Query",
                  "stripVariables": [],

                  "selection": {
                      "fields": {
                          "node": {
                              "type": "Node",
                              "keyRaw": "node(id: $id)",
                              "nullable": true,

                              "selection": {
                                  "fields": {
                                      "id": {
                                          "type": "ID",
                                          "keyRaw": "id",
                                          "visible": true,
                                      },
                                  },
                                  "abstractFields": {
                                      "fields": {
                                          "Friend": {
                                              "id": {
                                                  "type": "ID",
                                                  "keyRaw": "id",
                                                  "visible": true,
                                              },
                                              "name": {
                                                  "type": "String",
                                                  "keyRaw": "name",
                                                  "visible": true,
                                              },
                                          },
                                      },

                                      "typeMap": {
                                          "Cat": "Friend",
                                          "Dog": "Friend",
                                          "User": "Friend",
                                      }
                                  },
                              },

                              "abstract": true,
                              "visible": true,
                          },
                      },
                  },

                  "pluginData": {},

                  "input": {
                      "fields": {
                          "id": "ID",
                      },

                      "types": {},

                      "defaults": {},

                      "runtimeScalars": {},
                  },

                  "policy": "CacheOrNetwork",
                  "partial": false
              }

              "HoudiniHash=2bf1a6f13b012901b2017ee8b44c24d39fe7aa0725d68deea5a3e08d7393d671"
            
          `),
				},
			},
			{
				Name: "Operation inputs",
				Pass: true,
				Input: []string{
					`
            query TestQuery(
              $id: ID = "123",
              $filter: UserFilter,
              $filterList: [UserFilter!],
              $enumArg: MyEnum
            ) {
              user(
                id: $id,
                filter: $filter,
                filterList: $filterList,
                enumArg: $enumArg,
              ) {
                id
              }
            }
          `,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`
              export default {
                  "name": "TestQuery",
                  "kind": "HoudiniQuery",
                  "hash": "6f309527d440ef50e63cd0c7f20a2f8d17856c439f57ddfff52625749ca9e720",
                  "raw": ` + "`" + `query TestQuery($enumArg: MyEnum, $filter: UserFilter, $filterList: [UserFilter!], $id: ID = "123") {
                  user(enumArg: $enumArg, filter: $filter, filterList: $filterList, id: $id) {
                      id
                  }
              }
              ` + "`" + `,

                  "rootType": "Query",
                  "stripVariables": [],

                  "selection": {
                      "fields": {
                          "user": {
                              "type": "User",
                              "keyRaw": "user(enumArg: $enumArg, filter: $filter, filterList: $filterList, id: $id)",

                              "selection": {
                                  "fields": {
                                      "id": {
                                          "type": "ID",
                                          "keyRaw": "id",
                                          "visible": true,
                                      },
                                  },
                              },

                              "visible": true,
                          },
                      },
                  },

                  "pluginData": {},

                  "input": {
                      "fields": {
                          "id": "ID",
                          "filter": "UserFilter",
                          "filterList": "UserFilter",
                          "enumArg": "MyEnum",
                      },

                      "types": {
                          "NestedUserFilter": {
                              "admin": "Boolean",
                              "age": "Int",
                              "firstName": "String",
                              "id": "ID",
                              "weight": "Float",
                          },
                          "UserFilter": {
                              "enum": "MyEnum",
                              "listRequired": "String",
                              "middle": "NestedUserFilter",
                              "nullList": "String",
                              "recursive": "UserFilter",
                          },
                      },

                      "defaults": {
                          "id": "123",
                      },

                      "runtimeScalars": {},
                  },

                  "policy": "CacheOrNetwork",
                  "partial": false
              }

              "HoudiniHash=6f309527d440ef50e63cd0c7f20a2f8d17856c439f57ddfff52625749ca9e720"
	
          `),
				},
			},
			{
				Name: "Overlapping query and fragment nested selection",
				Pass: true,
				Input: []string{
					`fragment A on User { friends { ... on User { id } } }`,
					`query TestQuery {  friends {... on User { firstName } ...A } }`,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`
              export default {
                  "name": "TestQuery",
                  "kind": "HoudiniQuery",
                  "hash": "eb04a29974f886fc36008ccb90ce8a7d132a553cc3a7c58ef385deda38de9b5f",
                  "raw": ` + "`" + `fragment A on User {
                  friends {
                      ... on User {
                          id
                      }
                  }
              }

              query TestQuery {
                  friends {
                      ... on User {
                          firstName
                      }
                      ...A
                  }
              }
              ` + "`" + `,

                  "rootType": "Query",
                  "stripVariables": [],

                  "selection": {
                      "fields": {
                          "friends": {
                              "type": "Friend",
                              "keyRaw": "friends",

                              "selection": {
                                  "fragments": {
                                      "A": {
                                          "arguments": {}
                                      },
                                  },
                                  "abstractFields": {
                                      "fields": {
                                          "User": {
                                              "firstName": {
                                                  "type": "String",
                                                  "keyRaw": "firstName",
                                                  "visible": true,
                                              },
                                              "friends": {
                                                  "type": "User",
                                                  "keyRaw": "friends",

                                                  "selection": {
                                                      "abstractFields": {
                                                          "fields": {
                                                              "User": {
                                                                  "id": {
                                                                      "type": "ID",
                                                                      "keyRaw": "id",
                                                                  },
                                                              },
                                                          },

                                                          "typeMap": {
                                                              "User": "User",
                                                          }
                                                      },
                                                  },

                                              },
                                          },
                                      },

                                      "typeMap": {
                                          "User": "User",
                                      }
                                  },
                              },

                              "abstract": true,
                              "visible": true,
                          },
                      },
                  },

                  "pluginData": {},
                  "policy": "CacheOrNetwork",
                  "partial": false
              }

              "HoudiniHash=eb04a29974f886fc36008ccb90ce8a7d132a553cc3a7c58ef385deda38de9b5f"
            
          `),
				},
			},
			{
				Name: "Selections with interfaces",
				Pass: true,
				Input: []string{
					`query Friends {
              friends {
                  __typename
                  ... on Cat {
                      id
                      owner {
                          firstName
                      }
                  }
                  ... on User {
                      name
                  }
              }
          }`,
				},
				Extra: map[string]any{
					"Friends": tests.Dedent(`
              export default {
                  "name": "Friends",
                  "kind": "HoudiniQuery",
                  "hash": "5657a4184497c4a629f3d69a88a0a8cfc824bc09c5b04a6b46b6054fd8f6c9b2",
                  "raw": ` + "`" + `query Friends {
                  friends {
                      __typename
                      ... on Cat {
                          id
                          owner {
                              firstName
                          }
                      }
                      ... on User {
                          name
                      }
                  }
              }
              ` + "`" + `,

                  "rootType": "Query",
                  "stripVariables": [],

                  "selection": {
                      "fields": {
                          "friends": {
                              "type": "Friend",
                              "keyRaw": "friends",

                              "selection": {
                                  "fields": {
                                      "__typename": {
                                          "type": "String",
                                          "keyRaw": "__typename",
                                          "visible": true,
                                      },
                                  },
                                  "abstractFields": {
                                      "fields": {
                                          "Cat": {
                                              "__typename": {
                                                  "type": "String",
                                                  "keyRaw": "__typename",
                                                  "visible": true,
                                              },
                                              "id": {
                                                  "type": "ID",
                                                  "keyRaw": "id",
                                                  "visible": true,
                                              },
                                              "owner": {
                                                  "type": "User",
                                                  "keyRaw": "owner",

                                                  "selection": {
                                                      "fields": {
                                                          "firstName": {
                                                              "type": "String",
                                                              "keyRaw": "firstName",
                                                              "visible": true,
                                                          },
                                                      },
                                                  },

                                                  "visible": true,
                                              },
                                          },
                                          "User": {
                                              "__typename": {
                                                  "type": "String",
                                                  "keyRaw": "__typename",
                                                  "visible": true,
                                              },
                                              "name": {
                                                  "type": "String",
                                                  "keyRaw": "name",
                                                  "visible": true,
                                              },
                                          },
                                      },

                                      "typeMap": {
                                          "Cat": "Cat",
                                          "User": "User",
                                      }
                                  },
                              },

                              "abstract": true,
                              "visible": true,
                          },
                      },
                  },

                  "pluginData": {},
                  "policy": "CacheOrNetwork",
                  "partial": false
              }

              "HoudiniHash=5657a4184497c4a629f3d69a88a0a8cfc824bc09c5b04a6b46b6054fd8f6c9b2"
          `),
				},
			},
			{
				Name: "Selections with unions",
				Pass: true,
				Input: []string{
					`query Friends {
              pets {
                  __typename
                  ... on Cat {
                      id
                      owner {
                          firstName
                      }
                  }
                  ... on Dog {
                      name
                  }
              }
          }`,
				},
				Extra: map[string]any{
					"Friends": tests.Dedent(`
              export default {
                  "name": "Friends",
                  "kind": "HoudiniQuery",
                  "hash": "13b3f9bf2d4a8d9ceb7a9b4ae0e14e09a223994115f5427cbcd81095e729996d",
                  "raw": ` + "`" + `query Friends {
                  pets {
                      __typename
                      ... on Cat {
                          id
                          owner {
                              firstName
                          }
                      }
                      ... on Dog {
                          name
                      }
                  }
              }
              ` + "`" + `,

                  "rootType": "Query",
                  "stripVariables": [],

                  "selection": {
                      "fields": {
                          "pets": {
                              "type": "Pet",
                              "keyRaw": "pets",

                              "selection": {
                                  "fields": {
                                      "__typename": {
                                          "type": "String",
                                          "keyRaw": "__typename",
                                          "visible": true,
                                      },
                                  },
                                  "abstractFields": {
                                      "fields": {
                                          "Cat": {
                                              "__typename": {
                                                  "type": "String",
                                                  "keyRaw": "__typename",
                                                  "visible": true,
                                              },
                                              "id": {
                                                  "type": "ID",
                                                  "keyRaw": "id",
                                                  "visible": true,
                                              },
                                              "owner": {
                                                  "type": "User",
                                                  "keyRaw": "owner",

                                                  "selection": {
                                                      "fields": {
                                                          "firstName": {
                                                              "type": "String",
                                                              "keyRaw": "firstName",
                                                              "visible": true,
                                                          },
                                                      },
                                                  },

                                                  "visible": true,
                                              },
                                          },
                                          "Dog": {
                                              "__typename": {
                                                  "type": "String",
                                                  "keyRaw": "__typename",
                                                  "visible": true,
                                              },
                                              "name": {
                                                  "type": "String",
                                                  "keyRaw": "name",
                                                  "visible": true,
                                              },
                                          },
                                      },

                                      "typeMap": {
                                          "Cat": "Cat",
                                          "Dog": "Dog",
                                      }
                                  },
                              },

                              "abstract": true,
                              "visible": true,
                          },
                      },
                  },

                  "pluginData": {},
                  "policy": "CacheOrNetwork",
                  "partial": false
              }

              "HoudiniHash=13b3f9bf2d4a8d9ceb7a9b4ae0e14e09a223994115f5427cbcd81095e729996d"
          `),
				},
			},
			{
				Name: "Selections with overlapping unions",
				Pass: true,
				Input: []string{
					`query Friends {
              pets {
                  __typename
                  ... on Cat {
                      id
                  }
                  ... on Dog {
                      name
                  }
              }
          }`,
				},
				Extra: map[string]any{
					"Friends": tests.Dedent(`
              export default {
                  "name": "Friends",
                  "kind": "HoudiniQuery",
                  "hash": "ffa486fffb01e8d030ab8444796db47ed7a9a283750b17e053b286506ec89086",
                  "raw": ` + "`" + `query Friends {
                  pets {
                      __typename
                      ... on Cat {
                          id
                      }
                      ... on Dog {
                          name
                      }
                  }
              }
              ` + "`" + `,

                  "rootType": "Query",
                  "stripVariables": [],

                  "selection": {
                      "fields": {
                          "pets": {
                              "type": "Pet",
                              "keyRaw": "pets",

                              "selection": {
                                  "fields": {
                                      "__typename": {
                                          "type": "String",
                                          "keyRaw": "__typename",
                                          "visible": true,
                                      },
                                  },
                                  "abstractFields": {
                                      "fields": {
                                          "Cat": {
                                              "__typename": {
                                                  "type": "String",
                                                  "keyRaw": "__typename",
                                                  "visible": true,
                                              },
                                              "id": {
                                                  "type": "ID",
                                                  "keyRaw": "id",
                                                  "visible": true,
                                              },
                                          },
                                          "Dog": {
                                              "__typename": {
                                                  "type": "String",
                                                  "keyRaw": "__typename",
                                                  "visible": true,
                                              },
                                              "name": {
                                                  "type": "String",
                                                  "keyRaw": "name",
                                                  "visible": true,
                                              },
                                          },
                                      },

                                      "typeMap": {
                                          "Cat": "Cat",
                                          "Dog": "Dog",
                                      }
                                  },
                              },

                              "abstract": true,
                              "visible": true,
                          },
                      },
                  },

                  "pluginData": {},
                  "policy": "CacheOrNetwork",
                  "partial": false
              }

              "HoudiniHash=ffa486fffb01e8d030ab8444796db47ed7a9a283750b17e053b286506ec89086"
          `),
				},
			},
		},
	})
}
