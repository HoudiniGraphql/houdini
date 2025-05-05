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

      type User { 
        id: ID!
        firstName: String!
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
              users(stringValue: "foo") @list(name: "All_Users") {
                firstName
              }
            }`,
				},
				Extra: map[string]any{
					"A": tests.Dedent(`
              export default {
                  "name": "A",
                  "kind": "HoudiniMutation",
                  "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",
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
                                                  "firstName": {
                                                      "type": "String",
                                                      "keyRaw": "firstName"
                                                  },

                                                  "id": {
                                                      "type": "ID",
                                                      "keyRaw": "id",
                                                      "visible": true
                                                  }
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

              "HoudiniHash=c2cee63cc2dfd5eabad47ed394b64c91f6e19378bbf018b80c6e3391c3a56e5b"

          `),
				},
			},
		},
	})
}
