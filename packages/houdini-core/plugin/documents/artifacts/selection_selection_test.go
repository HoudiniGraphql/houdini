package artifacts_test

import (
	"context"
	"path"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents/artifacts"
	"code.houdinigraphql.com/plugins"
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
          offset: Int
          filter: UserFilter
        ): [User!]! 
				allItems: [TodoItem!]!
        entities: [Entity!]!
      } 

    	scalar DateTime
			type TodoItem {
				text: String!
				createdAt: DateTime!
			}


      interface Entity { 
        id: ID!
      }

      interface Node {
        id: ID!
      }

      type User implements Node & Friend & Entity {
        id: ID!
        name: String!
        bestFriend: User! 
        firstName: String!
        lastName: String!
        friends: [User!]!
        pets(name: String!, filter: PetFilter ): [Pet!]!
        friendsByOffset(offset: Int, filter: String): [User!]!
        field(filter: String): String
      }

      type Cat implements Node & Friend & Entity {
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
        name: String
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
                              "name": "String",
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
					`fragment A on User { friends { ... on User { lastName } } }`,
					`query TestQuery {  friends {... on User { firstName } ...A } }`,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`
              export default {
                  "name": "TestQuery",
                  "kind": "HoudiniQuery",
                  "hash": "8671a0ece7987aa1e7d26f011d737b70ff059b7df8ac62179b4f28f022bbb733",
                  "raw": ` + "`" + `fragment A on User {
                  friends {
                      ... on User {
                          lastName
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
                                                              "visible": true,
                                                          },

                                                          "id": {
                                                              "type": "ID",
                                                              "keyRaw": "id",
                                                              "visible": true,
                                                          },

                                                          "lastName": {
                                                              "type": "String",
                                                              "keyRaw": "lastName",
                                                          },
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

              "HoudiniHash=8671a0ece7987aa1e7d26f011d737b70ff059b7df8ac62179b4f28f022bbb733"
            
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
			{
				Name: "runtime scalars",
				Pass: true,
				ProjectConfig: func(config *plugins.ProjectConfig) {
					config.RuntimeScalars = map[string]string{
						"ViewerIDFromSession": "ID",
					}
				},
				Input: []string{
					`
            query AnimalsOverview($id: ViewerIDFromSession!) {
              node(id: $id) {
                id
              }
            }
          `,
				},
				Extra: map[string]any{
					"AnimalsOverview": tests.Dedent(`
              export default {
                  "name": "AnimalsOverview",
                  "kind": "HoudiniQuery",
                  "hash": "f22b0a14822ca0a8b66db1ba5a6c0fc948f13999a795f08306fccb42cefd16fa",
                  "raw": ` + "`" + `query AnimalsOverview($id: ID!) {
                  node(id: $id) {
                      id
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

                      "runtimeScalars": {
                          "id": "ViewerIDFromSession",
                      },
                  },

                  "policy": "CacheOrNetwork",
                  "partial": false
              }

              "HoudiniHash=f22b0a14822ca0a8b66db1ba5a6c0fc948f13999a795f08306fccb42cefd16fa"
            `),
				},
			},
			{
				Name: "default argument",
				Pass: true,
				Input: []string{
					`	
            query UserFriends($count: Int = 10, $search: String = "bob") {
              user {
                friendsByOffset(offset: $count, filter: $search) {
                  name
                }
              }
            }
          `,
				},
				Extra: map[string]any{
					"UserFriends": tests.Dedent(`
              export default {
                  "name": "UserFriends",
                  "kind": "HoudiniQuery",
                  "hash": "1be5e9c7dbda921f62f3e53a7ce7cca4649d50adaa16a7bfcabc5d2e711f7f73",
                  "raw": ` + "`" + `query UserFriends($count: Int = 10, $search: String = "bob") {
                  user {
                      friendsByOffset(filter: $search, offset: $count) {
                          name
                          __typename
                          id
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

                                      "friendsByOffset": {
                                          "type": "User",
                                          "keyRaw": "friendsByOffset(filter: $search, offset: $count)",

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
                          "count": "Int",
                          "search": "String",
                      },

                      "types": {},

                      "defaults": {
                          "count": 10,
                          "search": "bob",
                      },

                      "runtimeScalars": {},
                  },

                  "policy": "CacheOrNetwork",
                  "partial": false
              }

              "HoudiniHash=1be5e9c7dbda921f62f3e53a7ce7cca4649d50adaa16a7bfcabc5d2e711f7f73"
          `),
				},
			},
			{
				Name: "default argument handles base scalars correctly",
				Pass: true,
				Input: []string{
					`	
            query ListUsers($bool: Boolean = true, $int: Int = 5, $float: Float = 3.14, $string: String = "hello world") {
              users(boolValue: $bool, intValue: $int, floatValue: $float, stringValue: $string) {
                name
              }
            }
          `,
				},
				Extra: map[string]any{
					"ListUsers": tests.Dedent(`
              export default {
                  "name": "ListUsers",
                  "kind": "HoudiniQuery",
                  "hash": "459f81b6ef22858bdc88408194bf27be86886c2819e4498d57f211dca4e6499b",
                  "raw": ` + "`" + `query ListUsers($bool: Boolean = true, $float: Float = 3.14, $int: Int = 5, $string: String = "hello world") {
                  users(boolValue: $bool, floatValue: $float, intValue: $int, stringValue: $string) {
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
                          "users": {
                              "type": "User",
                              "keyRaw": "users(boolValue: $bool, floatValue: $float, intValue: $int, stringValue: $string)",

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
                          "bool": "Boolean",
                          "float": "Float",
                          "int": "Int",
                          "string": "String",
                      },

                      "types": {},

                      "defaults": {
                          "bool": true,
                          "float": 3.14,
                          "int": 5,
                          "string": "hello world",
                      },

                      "runtimeScalars": {},
                  },

                  "policy": "CacheOrNetwork",
                  "partial": false
              }

              "HoudiniHash=459f81b6ef22858bdc88408194bf27be86886c2819e4498d57f211dca4e6499b"
          `),
				},
			},
			{
				Name: "default argument handles complex default arguments",
				Pass: true,
				Input: []string{
					`	
            query FindUser($filter: UserFilter = { name: "bob" }) {
              users(offset: 5, filter: $filter) {
                name
              }
            }
          `,
				},
				Extra: map[string]any{
					"FindUser": tests.Dedent(`
              export default {
                  "name": "FindUser",
                  "kind": "HoudiniQuery",
                  "hash": "f960d0440b469f47aa1a2471c9f82a1709fec5959ed1d40aae1f0ecf537da4f7",
                  "raw": ` + "`" + `query FindUser($filter: UserFilter = {name: "bob"}) {
                  users(filter: $filter, offset: 5) {
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
                          "users": {
                              "type": "User",
                              "keyRaw": "users(filter: $filter, offset: 5)",

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
                          "filter": "UserFilter",
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
                              "name": "String",
                              "nullList": "String",
                              "recursive": "UserFilter",
                          },
                      },

                      "defaults": {
                          "filter": {name: "bob"},
                      },

                      "runtimeScalars": {},
                  },

                  "policy": "CacheOrNetwork",
                  "partial": false
              }

              "HoudiniHash=f960d0440b469f47aa1a2471c9f82a1709fec5959ed1d40aae1f0ecf537da4f7"
          `),
				},
			},
			{
				Name: "default dedupe arguments",
				Pass: true,
				Input: []string{
					`	
          query FindUser @dedupe {
                users {
                  name
                }
              }
          `,
				},
				Extra: map[string]any{
					"FindUser": tests.Dedent(`
              export default {
                  "name": "FindUser",
                  "kind": "HoudiniQuery",
                  "hash": "1420307316411f9ff8413670ae0fbe99ececa60b9a06071013ab6e152c6f9ea7",
                  "raw": ` + "`" + `query FindUser {
                  users {
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
                          "users": {
                              "type": "User",
                              "keyRaw": "users",

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

                  "dedupe": {
                      "cancel": "last",
                      "match": "Variables"
                  },
                  "policy": "CacheOrNetwork",
                  "partial": false
              }

              "HoudiniHash=1420307316411f9ff8413670ae0fbe99ececa60b9a06071013ab6e152c6f9ea7"
	        `),
				},
			},
			{
				Name: "persists dedupe which",
				Pass: true,
				Input: []string{
					`	
          query FindUser @dedupe(match: Operation) {
                users {
                  name
                }
              }
          `,
				},
				Extra: map[string]any{
					"FindUser": tests.Dedent(`
              export default {
                  "name": "FindUser",
                  "kind": "HoudiniQuery",
                  "hash": "1420307316411f9ff8413670ae0fbe99ececa60b9a06071013ab6e152c6f9ea7",
                  "raw": ` + "`" + `query FindUser {
                  users {
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
                          "users": {
                              "type": "User",
                              "keyRaw": "users",

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

                  "dedupe": {
                      "cancel": "last",
                      "match": "Operation"
                  },
                  "policy": "CacheOrNetwork",
                  "partial": false
              }

              "HoudiniHash=1420307316411f9ff8413670ae0fbe99ececa60b9a06071013ab6e152c6f9ea7"
	        `),
				},
			},
			{
				Name: "persists dedupe first",
				Pass: true,
				Input: []string{
					`	
          query FindUser @dedupe(cancelFirst: true) {
                users {
                  name
                }
              }
          `,
				},
				Extra: map[string]any{
					"FindUser": tests.Dedent(`
              export default {
                  "name": "FindUser",
                  "kind": "HoudiniQuery",
                  "hash": "1420307316411f9ff8413670ae0fbe99ececa60b9a06071013ab6e152c6f9ea7",
                  "raw": ` + "`" + `query FindUser {
                  users {
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
                          "users": {
                              "type": "User",
                              "keyRaw": "users",

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

                  "dedupe": {
                      "cancel": "first",
                      "match": "Variables"
                  },
                  "policy": "CacheOrNetwork",
                  "partial": false
              }

              "HoudiniHash=1420307316411f9ff8413670ae0fbe99ececa60b9a06071013ab6e152c6f9ea7"
	        `),
				},
			},
			{
				Name: "cache policy is persisted in artifact",
				Pass: true,
				Input: []string{
					`	
            query CachedFriends @cache(policy: CacheAndNetwork) {
                user {
                    friends {
                        id
                    }
                }
            }
          `,
				},
				Extra: map[string]any{
					"CachedFriends": tests.Dedent(`
              export default {
                  "name": "CachedFriends",
                  "kind": "HoudiniQuery",
                  "hash": "fbb42e5a593aa6dfbe7fda06d62dd9646761b32746bb30902417b751236b82e4",
                  "raw": ` + "`" + `query CachedFriends {
                  user {
                      friends {
                          id
                          __typename
                          id
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

                                      "friends": {
                                          "type": "User",
                                          "keyRaw": "friends",

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
                                          },

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

                  "pluginData": {},
                  "policy": "CacheAndNetwork",
                  "partial": false
              }

              "HoudiniHash=fbb42e5a593aa6dfbe7fda06d62dd9646761b32746bb30902417b751236b82e4"
            `),
				},
			},
			{
				Name: "can change default cache policy",
				Pass: true,
				ProjectConfig: func(config *plugins.ProjectConfig) {
					config.DefaultCachePolicy = "NetworkOnly"
				},
				Input: []string{
					`	
            query CachedFriends {
                user {
                    friends {
                        id
                    }
                }
            }
          `,
				},
				Extra: map[string]any{
					"CachedFriends": tests.Dedent(`
            export default {
                "name": "CachedFriends",
                "kind": "HoudiniQuery",
                "hash": "fbb42e5a593aa6dfbe7fda06d62dd9646761b32746bb30902417b751236b82e4",
                "raw": ` + "`" + `query CachedFriends {
                user {
                    friends {
                        id
                        __typename
                        id
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

                                    "friends": {
                                        "type": "User",
                                        "keyRaw": "friends",

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
                                        },

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

                "pluginData": {},
                "policy": "NetworkOnly",
                "partial": false
            }

            "HoudiniHash=fbb42e5a593aa6dfbe7fda06d62dd9646761b32746bb30902417b751236b82e4"
          `),
				},
			},
			{
				Name: "partial opt-in is persisted",
				Pass: true,
				Input: []string{
					`	
            query CachedFriends @cache(policy: CacheAndNetwork, partial: true) {
                user {
                    friends {
                        id
                    }
                }
            }
          `,
				},
				Extra: map[string]any{
					"CachedFriends": tests.Dedent(`
              export default {
                  "name": "CachedFriends",
                  "kind": "HoudiniQuery",
                  "hash": "fbb42e5a593aa6dfbe7fda06d62dd9646761b32746bb30902417b751236b82e4",
                  "raw": ` + "`" + `query CachedFriends {
                  user {
                      friends {
                          id
                          __typename
                          id
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

                                      "friends": {
                                          "type": "User",
                                          "keyRaw": "friends",

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
                                          },

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

                  "pluginData": {},
                  "policy": "CacheAndNetwork",
                  "partial": true
              }

              "HoudiniHash=fbb42e5a593aa6dfbe7fda06d62dd9646761b32746bb30902417b751236b82e4"
            `),
				},
			},
			{
				Name: "can set default partial opt-in",
				Pass: true,
				ProjectConfig: func(config *plugins.ProjectConfig) {
					config.DefaultPartial = true
				},
				Input: []string{
					`
            query CachedFriends @cache(policy: CacheAndNetwork) {
                user {
                    friends {
                        id
                    }
                }
            }	
          `,
				},
				Extra: map[string]any{
					"CachedFriends": tests.Dedent(`
              export default {
                  "name": "CachedFriends",
                  "kind": "HoudiniQuery",
                  "hash": "fbb42e5a593aa6dfbe7fda06d62dd9646761b32746bb30902417b751236b82e4",
                  "raw": ` + "`" + `query CachedFriends {
                  user {
                      friends {
                          id
                          __typename
                          id
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

                                      "friends": {
                                          "type": "User",
                                          "keyRaw": "friends",

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
                                          },

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

                  "pluginData": {},
                  "policy": "CacheAndNetwork",
                  "partial": true
              }

              "HoudiniHash=fbb42e5a593aa6dfbe7fda06d62dd9646761b32746bb30902417b751236b82e4"
            `),
				},
			},
			{
				Name: "fragments of unions inject correctly",
				Pass: true,
				Input: []string{
					` 
            query EntityList {
                entities {
                    ...EntityInfo
                }
            }
          `,
					`
            fragment EntityInfo on Entity {
                ... on User {
                    firstName
                }
                ... on Cat {
                    name
                }
            }
          `,
				},
				Extra: map[string]any{
					"EntityList": tests.Dedent(`
              export default {
                  "name": "EntityList",
                  "kind": "HoudiniQuery",
                  "hash": "41abe068027a3e99325fd911b69effe90a0a3aabbb2e1cdfed73dd37dd73677e",
                  "raw": ` + "`" + `fragment EntityInfo on Entity {
                  ... on User {
                      firstName
                      __typename
                      id
                  }
                  ... on Cat {
                      name
                      __typename
                      id
                  }
                  __typename
                  id
              }

              query EntityList {
                  entities {
                      ...EntityInfo
                      __typename
                      id
                  }
              }
              ` + "`" + `,

                  "rootType": "Query",
                  "stripVariables": [],

                  "selection": {
                      "fields": {
                          "entities": {
                              "type": "Entity",
                              "keyRaw": "entities",

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
                                              "name": {
                                                  "type": "String",
                                                  "keyRaw": "name",
                                              },
                                          },
                                          "User": {
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
                                      },

                                      "typeMap": {},
                                  },

                                  "fragments": {
                                      "EntityInfo": {
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

              "HoudiniHash=41abe068027a3e99325fd911b69effe90a0a3aabbb2e1cdfed73dd37dd73677e"
            `),
				},
			},
			{
				Name: "componentFields",
				Pass: true,
				Input: []string{
					` 
            query UserWithAvatar {
              user {
                Avatar
              }
            }
          `,
					`fragment UserAvatar on User @componentField(field: "Avatar", prop: "user") {
            firstName
            FriendList
          }`,
					`fragment FriendList on User @componentField(field: "FriendList", prop: "user") {
            firstName
          }`,
				},
				Extra: map[string]any{
					"UserWithAvatar": tests.Dedent(`
            export default {
                "name": "UserWithAvatar",
                "kind": "HoudiniQuery",
                "hash": "51262f47df33c40c18a8f4b081242dedd62c8ffb0fd94595ee122afb0e83ad71",
                "raw": ` + "`" + `fragment FriendList on User {
                firstName
                __typename
                id
            }

            fragment UserAvatar on User {
                firstName
                ...FriendList
                __typename
                id
            }

            query UserWithAvatar {
                user {
                    ...UserAvatar
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

                                    "FriendList": {
                                        "keyRaw": "FriendList",
                                        "type": "Component",
                                        "component": {
                                            "prop": "user",
                                            "key": "User.FriendList",
                                            "fragment": "FriendList",
                                            "variables": {}
                                        },
                                    },

                                    "Avatar": {
                                        "keyRaw": "Avatar",
                                        "type": "Component",
                                        "component": {
                                            "prop": "user",
                                            "key": "User.Avatar",
                                            "fragment": "UserAvatar",
                                            "variables": {}
                                        },
                                        "visible": true,
                                    },
                                },

                                "fragments": {
                                    "FriendList": {
                                        "arguments": {}
                                    },
                                    "UserAvatar": {
                                        "arguments": {}
                                    },
                                },
                            },

                            "visible": true,
                        },
                    },
                },

                "pluginData": {},
                "hasComponents": true,
                "policy": "CacheOrNetwork",
                "partial": false
            }

            "HoudiniHash=51262f47df33c40c18a8f4b081242dedd62c8ffb0fd94595ee122afb0e83ad71"
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
	err := p.AfterExtract(context.Background())
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
