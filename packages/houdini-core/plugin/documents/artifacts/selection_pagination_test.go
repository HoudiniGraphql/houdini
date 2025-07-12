package artifacts_test

import (
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins/tests"
)

func TestPaginationArtifacts(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig]{
		Schema: `
      scalar Cursor 

      type Query { 
        users: [User!]!
        user: User!
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
				friendsByCursorScalar(first: Int, after: Cursor, last: Int, before: Cursor, filter: String): UserConnection!
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
			{
				Name: "pagination arguments stays in key as its a SinglePage Mode",
				Input: []string{
					`
             fragment PaginatedFragment on User {
                friendsByCursor(first:10, filter: "hello") @paginate(mode: SinglePage) {
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
                      "mode": "SinglePage"
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
                              "keyRaw": "friendsByCursor(after: $after, before: $before, filter: \"hello\", first: $first, last: $last)::paginated",
                              "nullable": true,

                              "directives": [{
                                  "name": "paginate",
                                  "arguments": {
                                      "mode": {
                                          "kind": "EnumValue",
                                          "value": "SinglePage"
                                      }
                                  }
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
			{
				Name: "offset based pagination marks appropriate field",
				Input: []string{
					`
            fragment PaginatedFragment on User {
                friendsByOffset(limit:10, filter: "hello") @paginate {
					        id
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
                  "hash": "8db8af57b5b15be9612a2b0382befff91906f4ff7a3f2c4b0177b0cb422fa2cc",

                  "refetch": {
                      "path": ["friendsByOffset"],
                      "method": "offset",
                      "pageSize": 10,
                      "embedded": true,
                      "targetType": "User",
                      "paginated": true,
                      "direction": "forward",
                      "mode": "Infinite"
                  },

                  "raw": ` + "`" + `fragment PaginatedFragment on User {
                  friendsByOffset(filter: "hello", limit: $limit, offset: $offset) {
                      id
                      __typename
                      id
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

                          "friendsByOffset": {
                              "type": "User",
                              "keyRaw": "friendsByOffset(filter: \"hello\")::paginated",
                              "updates": ["append"],

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

                  "pluginData": {},

                  "input": {
                      "fields": {
                          "limit": "Int",
                          "offset": "Int",
                      },

                      "types": {},

                      "defaults": {
                          "limit": 10,
                      },

                      "runtimeScalars": {},
                  },

              }

              "HoudiniHash=8db8af57b5b15be9612a2b0382befff91906f4ff7a3f2c4b0177b0cb422fa2cc"
            `),
				},
			},
			{
				Name: "cursor as scalar gets the right pagination query argument types",
				Input: []string{
					`
            query ScalarPagination {
              user {
                friendsByCursorScalar(first:10, filter: "hello") @paginate {
                  edges {
                    node {
                      friendsByCursor {
                        edges {
                          node {
                            id
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          `,
				},
				Pass: true,
				Extra: map[string]any{
					"ScalarPagination": tests.Dedent(`
              export default {
                  "name": "ScalarPagination",
                  "kind": "HoudiniQuery",
                  "hash": "c1583a45c5b580484b41ed1788a31285f99b7b87599047cbf9c64193d43d019a",

                  "refetch": {
                      "path": ["user","friendsByCursorScalar"],
                      "method": "cursor",
                      "pageSize": 10,
                      "embedded": false,
                      "targetType": "Query",
                      "paginated": true,
                      "direction": "both",
                      "mode": "Infinite"
                  },

                  "raw": ` + "`" + `query ScalarPagination($after: Cursor, $before: Cursor, $first: Int = 10, $last: Int) {
                  user {
                      friendsByCursorScalar(after: $after, before: $before, filter: "hello", first: $first, last: $last) {
                          edges {
                              node {
                                  friendsByCursor {
                                      edges {
                                          node {
                                              id
                                              __typename
                                              id
                                          }
                                          __typename
                                      }
                                      __typename
                                  }
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

                                      "friendsByCursorScalar": {
                                          "type": "UserConnection",
                                          "keyRaw": "friendsByCursorScalar(filter: \"hello\")::paginated",

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

                                                                          "friendsByCursor": {
                                                                              "type": "UserConnection",
                                                                              "keyRaw": "friendsByCursor",
                                                                              "nullable": true,

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

                                                                                          "selection": {
                                                                                              "fields": {
                                                                                                  "__typename": {
                                                                                                      "type": "String",
                                                                                                      "keyRaw": "__typename",
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

                              "visible": true,
                          },
                      },
                  },

                  "pluginData": {},

                  "dedupe": {
                      "cancel": "last",
                      "match": "Variables"
                  },

                  "input": {
                      "fields": {
                          "after": "Cursor",
                          "before": "Cursor",
                          "first": "Int",
                          "last": "Int",
                      },

                      "types": {},

                      "defaults": {
                          "first": 10,
                      },

                      "runtimeScalars": {},
                  },

                  "policy": "CacheOrNetwork",
                  "partial": false
              }

              "HoudiniHash=c1583a45c5b580484b41ed1788a31285f99b7b87599047cbf9c64193d43d019a"
            `),
				},
			},
		},
	})
}
