package artifacts_test

import (
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins/tests"
)

func TestArtifactOperationsGeneration(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig]{
		Schema: `
      type Mutation { 
         addFriend: AddFriendOutput!
      }

      type Query { 
        users: [User!]!
      }

      type User { 
        id: ID!
        firstName: String!
        field(filter: String): String
      }

      type AddFriendOutput {
        friend: User!
      }
    `,
		PerformTest: performArtifactTest,
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "Mutation artifact properties",
				Pass: true,
				Input: []string{
					`mutation B {
            addFriend {
              friend {
                firstName
              }
            }
          }`,
				},
				Extra: map[string]any{
					"B": tests.Dedent(`
              export default {
                  "name": "B",
                  "kind": "HoudiniMutation",
                  "hash": "9ce380e593f0ad23179092018fff6667f3249e9fc261be13c40a7291c1f151c6",
                  "raw": ` + "`" + `mutation B {
                  addFriend {
                      friend {
                          firstName
                          __typename
                          id
                      }
                      __typename
                  }
              }
              ` + "`" + `,

                  "rootType": "Mutation",
                  "stripVariables": [],

                  "selection": {
                      "fields": {
                          "addFriend": {
                              "type": "AddFriendOutput",
                              "keyRaw": "addFriend",

                              "selection": {
                                  "fields": {
                                      "__typename": {
                                          "type": "String",
                                          "keyRaw": "__typename",
                                          "visible": true,
                                      },

                                      "friend": {
                                          "type": "User",
                                          "keyRaw": "friend",

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

              "HoudiniHash=9ce380e593f0ad23179092018fff6667f3249e9fc261be13c40a7291c1f151c6"

          `),
				},
			},
			{
				Name: "Insert operations",
				Pass: true,
				Input: []string{
					`mutation A {
              addFriend {
                friend {
                  ...All_Users_insert
                }
              }
            }`,
					`query TestQuery {
              users @list(name: "All_Users") {
                firstName
              }
            }`,
				},
				Extra: map[string]any{
					"A": tests.Dedent(`
              export default {
                  "name": "A",
                  "kind": "HoudiniMutation",
                  "hash": "425691bbfea3900b92488e1ab1c9d6ee50242cadb1de2336342766d9577656f1",
                  "raw": ` + "`" + `mutation A {
                  addFriend {
                      friend {
                          ...All_Users_insert
                          __typename
                          id
                      }
                      __typename
                  }
              }

              fragment All_Users_insert on User {
                  firstName
                  __typename
                  id
              }
              ` + "`" + `,

                  "rootType": "Mutation",
                  "stripVariables": [],

                  "selection": {
                      "fields": {
                          "addFriend": {
                              "type": "AddFriendOutput",
                              "keyRaw": "addFriend",

                              "selection": {
                                  "fields": {
                                      "__typename": {
                                          "type": "String",
                                          "keyRaw": "__typename",
                                          "visible": true,
                                      },

                                      "friend": {
                                          "type": "User",
                                          "keyRaw": "friend",

                                          "operations": [{
                                              "action": "insert",
                                              "list": "All_Users",
                                              "position": "last"
                                          }],

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
                                                  "All_Users_insert": {
                                                      "arguments": {}
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

              "HoudiniHash=425691bbfea3900b92488e1ab1c9d6ee50242cadb1de2336342766d9577656f1"

          `),
				},
			},
			{
				Name: "Insert operations and @with directive",
				Pass: true,
				Input: []string{
					`mutation A {
              addFriend {
                friend {
                    ...All_Users_insert @with(filter: "Hello World")
                }
              }
            }`,
					`query TestQuery($filter: String) {
              users @list(name: "All_Users") {
                firstName
                field(filter: $filter)
              }
            }`,
				},
				Extra: map[string]any{
					"A": tests.Dedent(`
              export default {
                  "name": "A",
                  "kind": "HoudiniMutation",
                  "hash": "478267e6079162675775c31eaffa1e1108c883b24f7b3ff81f1caed9ad415cd6",
                  "raw": ` + "`" + `mutation A {
                  addFriend {
                      friend {
                          ...All_Users_insert_kVR6H
                          __typename
                          id
                      }
                      __typename
                  }
              }

              fragment All_Users_insert_kVR6H on User {
                  firstName
                  __typename
                  id
                  field(filter: "Hello World")
              }
              ` + "`" + `,

                  "rootType": "Mutation",
                  "stripVariables": [],

                  "selection": {
                      "fields": {
                          "addFriend": {
                              "type": "AddFriendOutput",
                              "keyRaw": "addFriend",

                              "selection": {
                                  "fields": {
                                      "__typename": {
                                          "type": "String",
                                          "keyRaw": "__typename",
                                          "visible": true,
                                      },

                                      "friend": {
                                          "type": "User",
                                          "keyRaw": "friend",

                                          "operations": [{
                                              "action": "insert",
                                              "list": "All_Users",
                                              "position": "last"
                                          }],

                                          "selection": {
                                              "fields": {
                                                  "__typename": {
                                                      "type": "String",
                                                      "keyRaw": "__typename",
                                                      "visible": true,
                                                  },

                                                  "field": {
                                                      "type": "String",
                                                      "keyRaw": "field(filter: \"Hello World\")",
                                                      "nullable": true,
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
                                                  "All_Users_insert": {
                                                      "arguments": {
                                                          "filter": {
                                                              "kind": "StringValue",
                                                              "value": "Hello World"
                                                          }
                                                      }
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

              "HoudiniHash=478267e6079162675775c31eaffa1e1108c883b24f7b3ff81f1caed9ad415cd6"

          `),
				},
			},
		},
	})
}
