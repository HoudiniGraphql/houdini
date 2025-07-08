package artifacts_test

import (
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins/tests"
)

func TestPaginationArtifacts(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig]{
		Schema: `
      type Query { 
        users: [User!]!
      }

      type User implements  Node { 
        id: ID!
        name: String!
        firstName: String!
        friendsByCursor(
          first: Int, 
          last: Int, 
          before: String, 
          after: String, 
          filter: String
        ): UserConnection
    friendsByOffset(limit: Int, offset: Int, filter: String): [User!]!
      }

      type UserConnection { 
        edges: [UserEdge!]!
        pageInfo: PageInfo!
      }

      type PageInfo {
        hasNextPage: Boolean!
        hasPreviousPage: Boolean!
        startCursor: String
        endCursor: String
      }

      type UserEdge { 
        node: User
        cursor: String!
      }

      interface Node {
        id: ID!
      }
    `,
		PerformTest: performArtifactTest,
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "pagination arguments stripped from key",
				Input: []string{
					`
             fragment PaginatedFragment on User {
                friendsByCursor(first:10, filter: "hello") @paginate {
                    edges {
                        node {
                            id
                        }
                    }
                }
             }
          `,
				},
				Pass: true,
				Extra: map[string]any{
					"PaginatedFragment": tests.Dedent(`
              export default {
                  "name": "PaginatedFragment",
                  "kind": "HoudiniFragment",
                  "hash": "c4c850e8d6b0d281ff83c452fc5cd2aeabc1591f460d63fbe10d36e2a55f21f4",

                  "refetch": {
                      "path": ["friendsByCursor"],
                      "method": "cursor",
                      "pageSize": 10,
                      "embedded": true,
                      "targetType": "User",
                      "paginated": true,
                      "direction": "both",
                      "mode": "Infinite"
                  },

                  "raw": ` + "`" + `fragment PaginatedFragment on User {
                  friendsByCursor(after: $after, before: $before, filter: "hello", first: $first, last: $last) {
                      edges {
                          node {
                              id
                              __typename
                              id
                          }
                          __typename
                          cursor
                      }
                      __typename
                      pageInfo {
                          hasNextPage
                          hasPreviousPage
                          startCursor
                          endCursor
                      }
                  }
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

                          "friendsByCursor": {
                              "type": "UserConnection",
                              "keyRaw": "friendsByCursor(filter: \"hello\")::paginated",
                              "nullable": true,

                              "directives": [{
                                  "name": "paginate",
                                  "arguments": {}
                              }],


                              "selection": {
                                  "fields": {
                                      "__typename": {
                                          "type": "String",
                                          "keyRaw": "__typename",
                                          "visible": true,
                                      },

                                      "edges": {
                                          "type": "UserEdge",
                                          "keyRaw": "edges",
                                          "updates": ["append", "prepend"],

                                          "selection": {
                                              "fields": {
                                                  "__typename": {
                                                      "type": "String",
                                                      "keyRaw": "__typename",
                                                      "visible": true,
                                                  },

                                                  "cursor": {
                                                      "type": "String",
                                                      "keyRaw": "cursor",
                                                      "visible": true,
                                                  },

                                                  "node": {
                                                      "type": "User",
                                                      "keyRaw": "node",
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

                                                      "visible": true,
                                                  },
                                              },
                                          },

                                          "visible": true,
                                      },

                                      "pageInfo": {
                                          "type": "PageInfo",
                                          "keyRaw": "pageInfo",

                                          "selection": {
                                              "fields": {
                                                  "endCursor": {
                                                      "type": "String",
                                                      "keyRaw": "endCursor",
                                                      "updates": ["append", "prepend"],
                                                      "nullable": true,
                                                      "visible": true,
                                                  },

                                                  "hasNextPage": {
                                                      "type": "Boolean",
                                                      "keyRaw": "hasNextPage",
                                                      "updates": ["append", "prepend"],
                                                      "visible": true,
                                                  },

                                                  "hasPreviousPage": {
                                                      "type": "Boolean",
                                                      "keyRaw": "hasPreviousPage",
                                                      "updates": ["append", "prepend"],
                                                      "visible": true,
                                                  },

                                                  "startCursor": {
                                                      "type": "String",
                                                      "keyRaw": "startCursor",
                                                      "updates": ["append", "prepend"],
                                                      "nullable": true,
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

                          "id": {
                              "type": "ID",
                              "keyRaw": "id",
                              "visible": true,
                          },
                      },
                  },

                  "pluginData": {},

                  "input": {
                      "fields": {
                          "after": "String",
                          "before": "String",
                          "first": "Int",
                          "last": "Int",
                      },

                      "types": {},

                      "defaults": {
                          "first": 10,
                      },

                      "runtimeScalars": {},
                  },

              }

              "HoudiniHash=c4c850e8d6b0d281ff83c452fc5cd2aeabc1591f460d63fbe10d36e2a55f21f4"
            `),
				},
			},
		},
	})
}
