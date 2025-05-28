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
        users(
          stringValue: String
          boolValue: Boolean
          floatValue: Float
          intValue: Int
        ): [User!]! 
				allItems: [TodoItem!]!
      } 

    	scalar DateTime
			type TodoItem {
				text: String!
				createdAt: DateTime!
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
        field(filter: String): String
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

      type NewUserResult { 
        user: User!
      }

      type Subscription { 
        newUser: NewUserResult!
      }
    `,
		PerformTest: performArtifactTest,
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
                "hash": "f16f17ca970d9631a408c829217f5ee1883a16dc72dbdbac018a789ab7a951ba",
                "raw": ` + "`" + `fragment TestFragment on User {
                firstName
                id
                __typename
                id
            }
            ` + "`" + `,

                "rootType": "User",
                "stripVariables": [],

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                            "visible": true,
                        },

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
            }

            "HoudiniHash=f16f17ca970d9631a408c829217f5ee1883a16dc72dbdbac018a789ab7a951ba"
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
            }
          `,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`
            export default {
                "name": "TestQuery",
                "kind": "HoudiniQuery",
                "hash": "2c9c28f8cb271806d458dfe004805956234eba3596c9ab6f5fded8a16de61275",
                "raw": ` + "`" + `fragment TestFragment on User {
                firstName
                __typename
                id
            }
            
            query TestQuery {
                user {
                    ...TestFragment
                    __typename
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
                            "keyRaw": "user",

                            "selection": {
                                "fields": {
                                    "__typename": {
                                        "type": "String",
                                        "keyRaw": "__typename",
                                        "visible": true,
                                    },

                                    "firstName": {
                                        "type": "String",
                                        "keyRaw": "firstName",
                                    },

                                    "id": {
                                        "type": "ID",
                                        "keyRaw": "id",
                                        "visible": true,
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

            "HoudiniHash=2c9c28f8cb271806d458dfe004805956234eba3596c9ab6f5fded8a16de61275"

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
    }
  `,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`
              export default {
                  "name": "TestQuery",
                  "kind": "HoudiniQuery",
                  "hash": "a4461c0ad54e630a8bcefb242ada528478dedb87e1c48a72e5efae7fe66065ee",
                  "raw": ` + "`" + `fragment TestFragment on User {
                  firstName
                  __typename
                  id
              }
              
              query TestQuery {
                  user {
                      firstName
                      ...TestFragment
                      __typename
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
                              "keyRaw": "user",

                              "selection": {
                                  "fields": {
                                      "__typename": {
                                          "type": "String",
                                          "keyRaw": "__typename",
                                          "visible": true,
                                      },

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

              "HoudiniHash=a4461c0ad54e630a8bcefb242ada528478dedb87e1c48a72e5efae7fe66065ee"
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
                  "hash": "42a4210cd0fa0394e1256a751a9c7a8acbbeafb6efc4578260c4c0aa482cc0ae",
                  "raw": ` + "`" + `query MyQuery($id: ID!) {
                  node(id: $id) {
                      ... on Friend {
                          name
                          __typename
                      }
                      __typename
                      id
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
                                  "abstractFields": {
                                      "fields": {
                                          "Friend": {
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
                                      },
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

              "HoudiniHash=42a4210cd0fa0394e1256a751a9c7a8acbbeafb6efc4578260c4c0aa482cc0ae"
            
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
                name
              }
            }
          `,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`
              export default {
                  "name": "TestQuery",
                  "kind": "HoudiniQuery",
                  "hash": "fd7aa425b2f63c25bb733385c5337c0f128be116a423c65722b23a616b02d1f7",
                  "raw": ` + "`" + `query TestQuery($enumArg: MyEnum, $filter: UserFilter, $filterList: [UserFilter!], $id: ID = "123") {
                  user(enumArg: $enumArg, filter: $filter, filterList: $filterList, id: $id) {
                      name
                      __typename
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

                                      "name": {
                                          "type": "String",
                                          "keyRaw": "name",
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
                          "enumArg": "MyEnum",
                          "filter": "UserFilter",
                          "filterList": "UserFilter",
                          "id": "ID",
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

              "HoudiniHash=fd7aa425b2f63c25bb733385c5337c0f128be116a423c65722b23a616b02d1f7"
	
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
                  "hash": "c5f86d99ea9ca1b6b598e05ce1c898425c9f085a6841462672d65b30b491b317",
                  "raw": ` + "`" + `fragment A on User {
                  friends {
                      ... on User {
                          id
                          __typename
                          id
                      }
                      __typename
                      id
                  }
                  __typename
                  id
              }

              query TestQuery {
                  friends {
                      ... on User {
                          firstName
                          __typename
                          id
                      }
                      ...A
                      __typename
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
                                          "User": {
                                              "__typename": {
                                                  "type": "String",
                                                  "keyRaw": "__typename",
                                                  "visible": true,
                                              },
                                              "firstName": {
                                                  "type": "String",
                                                  "keyRaw": "firstName",
                                                  "visible": true,
                                              },
                                              "friends": {
                                                  "type": "User",
                                                  "keyRaw": "friends",

                                                  "selection": {
                                                      "fields": {
                                                          "__typename": {
                                                              "type": "String",
                                                              "keyRaw": "__typename",
                                                          },

                                                          "id": {
                                                              "type": "ID",
                                                              "keyRaw": "id",
                                                          },
                                                      },
                                                      "abstractFields": {
                                                          "fields": {
                                                              "User": {
                                                                  "__typename": {
                                                                      "type": "String",
                                                                      "keyRaw": "__typename",
                                                                  },
                                                                  "id": {
                                                                      "type": "ID",
                                                                      "keyRaw": "id",
                                                                  },
                                                              },
                                                          },

                                                          "typeMap": {},
                                                      },
                                                  },

                                              },
                                              "id": {
                                                  "type": "ID",
                                                  "keyRaw": "id",
                                                  "visible": true,
                                              },
                                          },
                                      },

                                      "typeMap": {},
                                  },

                                  "fragments": {
                                      "A": {
                                          "arguments": {}
                                      },
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

              "HoudiniHash=c5f86d99ea9ca1b6b598e05ce1c898425c9f085a6841462672d65b30b491b317"
            
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
                  "hash": "8d4f14f66b2387a8a8778486fdfe6c0cf6923c60973f9586d543108da374f713",
                  "raw": ` + "`" + `query Friends {
                  friends {
                      __typename
                      ... on Cat {
                          id
                          owner {
                              firstName
                              __typename
                              id
                          }
                          __typename
                          id
                      }
                      ... on User {
                          name
                          __typename
                          id
                      }
                      __typename
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
                                                          "__typename": {
                                                              "type": "String",
                                                              "keyRaw": "__typename",
                                                              "visible": true,
                                                          },

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

                                                  "visible": true,
                                              },
                                          },
                                          "User": {
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
                                              "name": {
                                                  "type": "String",
                                                  "keyRaw": "name",
                                                  "visible": true,
                                              },
                                          },
                                      },

                                      "typeMap": {},
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

              "HoudiniHash=8d4f14f66b2387a8a8778486fdfe6c0cf6923c60973f9586d543108da374f713"
          `),
				},
			},
			{
				Name: "Selections with unions",
				Pass: true,
				Input: []string{
					`query Friends {
              pets {
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
                  "hash": "bc12a484d03051a7bc129c6721546e9a4726dcd753da49f2224f89e0b1d6acaa",
                  "raw": ` + "`" + `query Friends {
                  pets {
                      ... on Cat {
                          id
                          owner {
                              firstName
                              __typename
                              id
                          }
                          __typename
                          id
                      }
                      ... on Dog {
                          name
                          __typename
                          id
                      }
                      __typename
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
                                                          "__typename": {
                                                              "type": "String",
                                                              "keyRaw": "__typename",
                                                              "visible": true,
                                                          },

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

                                                  "visible": true,
                                              },
                                          },
                                          "Dog": {
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
                                              "name": {
                                                  "type": "String",
                                                  "keyRaw": "name",
                                                  "visible": true,
                                              },
                                          },
                                      },

                                      "typeMap": {},
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

              "HoudiniHash=bc12a484d03051a7bc129c6721546e9a4726dcd753da49f2224f89e0b1d6acaa"
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
                  "hash": "904ac35930c3920b2aa20644f342c6794a4ef3caac783cad5589a97b0a5eeb2c",
                  "raw": ` + "`" + `query Friends {
                  pets {
                      __typename
                      ... on Cat {
                          id
                          __typename
                          id
                      }
                      ... on Dog {
                          name
                          __typename
                          id
                      }
                      __typename
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

                                      "typeMap": {},
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

              "HoudiniHash=904ac35930c3920b2aa20644f342c6794a4ef3caac783cad5589a97b0a5eeb2c"
          `),
				},
			},
			{
				Name: "field args",
				Pass: true,
				Input: []string{
					`query TestQuery($value: String!) {
            users(
              stringValue: $value,
              boolValue: true,
              floatValue: 1.2,
              intValue: 1,
            ) @list(name: "All_Users") {
              firstName
            }
          }`,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`
              export default {
                  "name": "TestQuery",
                  "kind": "HoudiniQuery",
                  "hash": "dc502dd533f31553a3c311a7aaa782d82f81d7f7a8816d5095f96584a7600004",
                  "raw": ` + "`" + `query TestQuery($value: String!) {
                  users(boolValue: true, floatValue: 1.2, intValue: 1, stringValue: $value) {
                      firstName
                      __typename
                      id
                  }
              }
              ` + "`" + `,

                  "rootType": "Query",
                  "stripVariables": [],

                  "selection": {
                      "fields": {
                          "users": {
                              "type": "User",
                              "keyRaw": "users(boolValue: true, floatValue: 1.2, intValue: 1, stringValue: $value)",

                              "directives": [{
                                  "name": "list",
                                  "arguments": {
                                      "name": {
                                          "kind": "StringValue",
                                          "value": "All_Users"
                                      }
                                  }
                              }],

                              "list": {
                                  "name": "All_Users",
                                  "connection": false,
                                  "type": "User"
                              },

                              "selection": {
                                  "fields": {
                                      "__typename": {
                                          "type": "String",
                                          "keyRaw": "__typename",
                                          "visible": true,
                                      },

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

                              "filters": {
                                  "boolValue": {
                                      "kind": "Boolean",
                                      "value": true
                                  },
                                  "floatValue": {
                                      "kind": "Float",
                                      "value": 1.2
                                  },
                                  "intValue": {
                                      "kind": "Int",
                                      "value": 1
                                  },
                                  "stringValue": {
                                      "kind": "Variable",
                                      "value": "value"
                                  },
                              },
                              "visible": true,
                          },
                      },
                  },

                  "pluginData": {},

                  "input": {
                      "fields": {
                          "value": "String",
                      },

                      "types": {},

                      "defaults": {},

                      "runtimeScalars": {},
                  },

                  "policy": "CacheOrNetwork",
                  "partial": false
              }

              "HoudiniHash=dc502dd533f31553a3c311a7aaa782d82f81d7f7a8816d5095f96584a7600004"
          `),
				},
			},
			{
				Name: "custom scalars show up in artifact",
				Pass: true,
				Input: []string{
					`query TestQuery { allItems { createdAt } }`,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`
              export default {
                  "name": "TestQuery",
                  "kind": "HoudiniQuery",
                  "hash": "6ab84d7e483ecf5559a0ab69cc5983b1c74c8abc61170ff82ed304dca7a6b178",
                  "raw": ` + "`" + `query TestQuery {
                  allItems {
                      createdAt
                      __typename
                  }
              }
              ` + "`" + `,

                  "rootType": "Query",
                  "stripVariables": [],

                  "selection": {
                      "fields": {
                          "allItems": {
                              "type": "TodoItem",
                              "keyRaw": "allItems",

                              "selection": {
                                  "fields": {
                                      "__typename": {
                                          "type": "String",
                                          "keyRaw": "__typename",
                                          "visible": true,
                                      },

                                      "createdAt": {
                                          "type": "DateTime",
                                          "keyRaw": "createdAt",
                                          "visible": true,
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

              "HoudiniHash=6ab84d7e483ecf5559a0ab69cc5983b1c74c8abc61170ff82ed304dca7a6b178"
          `),
				},
			},
			{
				Name: "subscription happy path",
				Pass: true,
				Input: []string{
					`subscription B {
            newUser {
              user {
                firstName
              }
            }
          }`,
				},
				Extra: map[string]any{
					"B": tests.Dedent(`
            export default {
                "name": "B",
                "kind": "HoudiniSubscription",
                "hash": "296a21f0071cbe117a6db1565e144775e4c1461a843fd019b4e840c80bfb17be",
                "raw": ` + "`" + `subscription B {
                newUser {
                    user {
                        firstName
                        __typename
                        id
                    }
                    __typename
                }
            }
            ` + "`" + `,

                "rootType": "Subscription",
                "stripVariables": [],

                "selection": {
                    "fields": {
                        "newUser": {
                            "type": "NewUserResult",
                            "keyRaw": "newUser",

                            "selection": {
                                "fields": {
                                    "__typename": {
                                        "type": "String",
                                        "keyRaw": "__typename",
                                        "visible": true,
                                    },

                                    "user": {
                                        "type": "User",
                                        "keyRaw": "user",

                                        "selection": {
                                            "fields": {
                                                "__typename": {
                                                    "type": "String",
                                                    "keyRaw": "__typename",
                                                    "visible": true,
                                                },

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

                                        "visible": true,
                                    },
                                },
                            },

                            "visible": true,
                        },
                    },
                },

                "pluginData": {},
            }

            "HoudiniHash=296a21f0071cbe117a6db1565e144775e4c1461a843fd019b4e840c80bfb17be"
          `),
				},
			},
			{
				Name: "nested recursive fragments",
				Pass: true,
				Input: []string{
					`
            query NestedQuery {
              node(id: "some_id") {
                id

                ...NodeDetails

                ... on User {
                  ...UserThings
                }
              }
            }
          `,
					`
            fragment UserThings on User {
              id
              name

              ...NodeDetails
            }
          `,
					`
            fragment NodeDetails on Node {
              id

              ... on User {
                id
              }
            }
          `,
				},
				Extra: map[string]any{
					"NestedQuery": tests.Dedent(`
              export default {
                  "name": "NestedQuery",
                  "kind": "HoudiniQuery",
                  "hash": "ba8ea3a311642f195ad5a9181f84d7ff3b098ca6e0951263d76f8fa20e984862",
                  "raw": ` + "`" + `query NestedQuery {
                  node(id: "some_id") {
                      id
                      ...NodeDetails
                      ... on User {
                          ...UserThings
                          __typename
                          id
                      }
                      __typename
                      id
                  }
              }

              fragment NodeDetails on Node {
                  id
                  ... on User {
                      id
                      __typename
                      id
                  }
                  __typename
                  id
              }

              fragment UserThings on User {
                  id
                  name
                  ...NodeDetails
                  __typename
                  id
              }
              ` + "`" + `,

                  "rootType": "Query",
                  "stripVariables": [],

                  "selection": {
                      "fields": {
                          "node": {
                              "type": "Node",
                              "keyRaw": "node(id: \"some_id\")",
                              "nullable": true,

                              "selection": {
                                  "fields": {
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
                                  "abstractFields": {
                                      "fields": {
                                          "User": {
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
                                              "name": {
                                                  "type": "String",
                                                  "keyRaw": "name",
                                              },
                                          },
                                      },

                                      "typeMap": {},
                                  },

                                  "fragments": {
                                      "NodeDetails": {
                                          "arguments": {}
                                      },
                                      "UserThings": {
                                          "arguments": {}
                                      },
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

              "HoudiniHash=ba8ea3a311642f195ad5a9181f84d7ff3b098ca6e0951263d76f8fa20e984862"
	      `),
				},
			},
			{
				Name: "leave @include and @skip alone",
				Pass: true,
				Input: []string{
					`query TestQuery {
            node(id: "some_id") {
              id @skip(if: true)

              ...NodeDetails @include(if:true)
            }
          }`,
					`
          fragment NodeDetails on Node {
            id

            ... on User {
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
                "hash": "a8731124dd26213d475ec6bf6c8fb65cbc280da96a98bcdc45194024ab3be287",
                "raw": ` + "`" + `fragment NodeDetails on Node {
                id
                ... on User {
                    id
                    __typename
                    id
                }
                __typename
                id
            }

            query TestQuery {
                node(id: "some_id") {
                    id @skip(if: true)
                    ...NodeDetails @include(if: true)
                    __typename
                    id
                }
            }
            ` + "`" + `,

                "rootType": "Query",
                "stripVariables": [],

                "selection": {
                    "fields": {
                        "node": {
                            "type": "Node",
                            "keyRaw": "node(id: \"some_id\")",
                            "nullable": true,

                            "selection": {
                                "fields": {
                                    "__typename": {
                                        "type": "String",
                                        "keyRaw": "__typename",
                                        "visible": true,
                                    },

                                    "id": {
                                        "type": "ID",
                                        "keyRaw": "id",

                                        "directives": [{
                                            "name": "skip",
                                            "arguments": {
                                                "if": {
                                                    "kind": "BooleanValue",
                                                    "value": true
                                                }
                                            }
                                        }],

                                        "visible": true,
                                    },
                                },
                                "abstractFields": {
                                    "fields": {
                                        "User": {
                                            "__typename": {
                                                "type": "String",
                                                "keyRaw": "__typename",
                                                "visible": true,
                                            },
                                            "id": {
                                                "type": "ID",
                                                "keyRaw": "id",

                                                "directives": [{
                                                    "name": "skip",
                                                    "arguments": {
                                                        "if": {
                                                            "kind": "BooleanValue",
                                                            "value": true
                                                        }
                                                    }
                                                }],

                                                "visible": true,
                                            },
                                        },
                                    },

                                    "typeMap": {},
                                },

                                "fragments": {
                                    "NodeDetails": {
                                        "arguments": {}
                                    },
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

            "HoudiniHash=a8731124dd26213d475ec6bf6c8fb65cbc280da96a98bcdc45194024ab3be287"

          `),
				},
			},
			{
				Name: "fragment variables are embedded in artifact",
				Pass: true,
				Input: []string{
					`
            query TestQuery {
              node(id: "some_id") {
                id
                ...NodeDetails @with(name: "Foo")

              }
            }
          `,
					`
            fragment NodeDetails on Node @arguments(name: { type: "String" }){
              ... on User {
                field(filter: $name)
              }
            }
          `,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`
              export default {
                  "name": "TestQuery",
                  "kind": "HoudiniQuery",
                  "hash": "f0a41849268b29defc9cf3fda4a9df1d09f65946338169f99b7d51019101b624",
                  "raw": ` + "`" + `fragment NodeDetails_33ZDpt on Node {
                  ... on User {
                      __typename
                      id
                      field(filter: "Foo")
                  }
                  __typename
                  id
              }

              query TestQuery {
                  node(id: "some_id") {
                      id
                      ...NodeDetails_33ZDpt
                      __typename
                      id
                  }
              }
              ` + "`" + `,

                  "rootType": "Query",
                  "stripVariables": [],

                  "selection": {
                      "fields": {
                          "node": {
                              "type": "Node",
                              "keyRaw": "node(id: \"some_id\")",
                              "nullable": true,

                              "selection": {
                                  "fields": {
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
                                  "abstractFields": {
                                      "fields": {
                                          "User": {
                                              "__typename": {
                                                  "type": "String",
                                                  "keyRaw": "__typename",
                                                  "visible": true,
                                              },
                                              "field": {
                                                  "type": "String",
                                                  "keyRaw": "field(filter: \"Foo\")",
                                                  "nullable": true,
                                              },
                                              "id": {
                                                  "type": "ID",
                                                  "keyRaw": "id",
                                                  "visible": true,
                                              },
                                          },
                                      },

                                      "typeMap": {},
                                  },

                                  "fragments": {
                                      "NodeDetails": {
                                          "arguments": {
                                              "name": {
                                                  "kind": "StringValue",
                                                  "value": "Foo"
                                              },
                                          }
                                      },
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

              "HoudiniHash=f0a41849268b29defc9cf3fda4a9df1d09f65946338169f99b7d51019101b624"
          `),
				},
			},
			{
				Name: "fragment variables are embedded in artifact",
				Pass: true,
				Input: []string{
					`
            fragment UserBase on User {
              id
              firstName
              ...UserMore
            }
          `,
					`
            fragment UserMore on User {
              id
              firstName
            }
          `,
				},
				Extra: map[string]any{
					"UserBase": tests.Dedent(`
              export default {
                  "name": "UserBase",
                  "kind": "HoudiniFragment",
                  "hash": "362236cc6faafb62f3994052dcb4082866d18ca0d7f3633d15e23e49a3f22fbd",
                  "raw": ` + "`" + `fragment UserBase on User {
                  id
                  firstName
                  ...UserMore
                  __typename
                  id
              }

              fragment UserMore on User {
                  id
                  firstName
                  __typename
                  id
              }
              ` + "`" + `,

                  "rootType": "User",
                  "stripVariables": [],

                  "selection": {
                      "fields": {
                          "__typename": {
                              "type": "String",
                              "keyRaw": "__typename",
                              "visible": true,
                          },

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

                      "fragments": {
                          "UserMore": {
                              "arguments": {}
                          },
                      },
                  },

                  "pluginData": {},
              }

              "HoudiniHash=362236cc6faafb62f3994052dcb4082866d18ca0d7f3633d15e23e49a3f22fbd"

          `),
				},
			},
		},
	})
}

func performArtifactTest(
	t *testing.T,
	p *plugin.HoudiniCore,
	test tests.Test[config.PluginConfig],
) {
	// load the documents into the database
	err := documents.LoadDocuments(context.Background(), p.DB)
	if err != nil {
		require.False(t, test.Pass, err.Error())
		return
	}

	err = p.Validate(context.Background())
	if err != nil {
		require.False(t, test.Pass, err.Error())
		return
	}

	err = p.AfterValidate(context.Background())
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
}
