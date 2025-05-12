package artifacts_test

import (
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins/tests"
)

func TestPaginationArtifacts(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig]{
		Schema: `
      type Mutation { 
         addFriend: AddFriendOutput!
      }

      type Query { 
        users(
          stringValue: String,
          boolValue: Boolean,
          floatValue: Float,
          intValue: Int
        ): [User!]!
      }

      type User { 
        id: ID!
        firstName: String!
      }

      type AddFriendOutput {
        friend: User
      }
    `,
		PerformTest: performArtifactTest,
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "list filters",
				Pass: true,
				Input: []string{
					`mutation A {
            addFriend {
              friend {
                ...All_Users_insert @when_not(boolValue: true)
              }
            }
          }`,
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
		},
	})
}
