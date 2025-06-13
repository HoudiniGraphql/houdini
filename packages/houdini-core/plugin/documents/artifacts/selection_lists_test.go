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
        catMutation: Cat
      }

      type Query { 
        users(
          stringValue: String,
          boolValue: Boolean,
          floatValue: Float,
          intValue: Int
        ): [User!]!
        usersByCursor(first: Int, last: Int, after: String, before: String): UserConnection!
				animals(first: Int, after: String): AnimalConnection
        entities: [Entity!]!
      }

      type User implements Entity { 
        id: ID!
        name: String!
        firstName: String!
      }

      type Cat implements Entity { 
        name: String!
        id: ID!
      }

      type UserConnection { 
        edges: [UserEdge!]!
        pageInfo: PageInfo!
      }

			interface Animal {
				id: ID!
				name: String!
			}

			type Monkey implements Animal {
				id: ID!
				name: String!
				hasBanana: Boolean!
			}

      interface Entity { 
        id: ID!
      }

			interface AnimalConnection {
				edges: [AnimalEdge!]!
				pageInfo: PageInfo!
			}

			interface AnimalEdge {
				cursor: String
				node: Animal
			}

			type MonkeyConnection implements AnimalConnection {
				edges: [MonkeyEdge!]!
				pageInfo: PageInfo!
			}

			type MonkeyEdge implements AnimalEdge {
				cursor: String
				node: Monkey
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
			{
				Name: "tacks paginate name",
				Pass: true,
				Input: []string{
					`query TestQuery {
            usersByCursor(first: 10) @paginate(name: "All_Users") {
              edges { 
                node { 
                  firstName
                }
              }
            }
          }`,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`
              export default {
                  "name": "TestQuery",
                  "kind": "HoudiniQuery",
                  "hash": "2ab71008736af6ef21d3e5a414af57585acb8921743df58a4f258a88407fd212",

                  "refetch": {
                      "path": ["usersByCursor"],
                      "method": "cursor",
                      "pageSize": 10,
                      "embedded": false,
                      "targetType": "Query",
                      "paginated": true,
                      "direction": "both",
                      "mode": "Infinite"
                  },

                  "raw": ` + "`" + `query TestQuery($after: String, $before: String, $first: Int = 10, $last: Int) {
                  usersByCursor(after: $after, before: $before, first: $first, last: $last) {
                      edges {
                          node {
                              firstName
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
              }
              ` + "`" + `,

                  "rootType": "Query",
                  "stripVariables": [],

                  "selection": {
                      "fields": {
                          "usersByCursor": {
                              "type": "UserConnection",
                              "keyRaw": "usersByCursor::paginated",

                              "directives": [{
                                  "name": "paginate",
                                  "arguments": {
                                      "name": {
                                          "kind": "StringValue",
                                          "value": "All_Users"
                                      }
                                  }
                              }],

                              "list": {
                                  "name": "All_Users",
                                  "connection": true,
                                  "type": "User"
                              },

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

                              "filters": {
                                  "after": {
                                      "kind": "Variable",
                                      "value": "after"
                                  },
                                  "before": {
                                      "kind": "Variable",
                                      "value": "before"
                                  },
                                  "first": {
                                      "kind": "Variable",
                                      "value": "first"
                                  },
                                  "last": {
                                      "kind": "Variable",
                                      "value": "last"
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

                  "policy": "CacheOrNetwork",
                  "partial": false
              }

              "HoudiniHash=2ab71008736af6ef21d3e5a414af57585acb8921743df58a4f258a88407fd212"

          `),
				},
			},
			{
				Name: "tacks paginate mode",
				Pass: true,
				Input: []string{
					`query TestQuery {
            usersByCursor(first: 10) @paginate(name: "All_Users", mode: "SinglePage") {
              edges { 
                node { 
                  firstName
                }
              }
            }
          }`,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`
              export default {
                  "name": "TestQuery",
                  "kind": "HoudiniQuery",
                  "hash": "2ab71008736af6ef21d3e5a414af57585acb8921743df58a4f258a88407fd212",

                  "refetch": {
                      "path": ["usersByCursor"],
                      "method": "cursor",
                      "pageSize": 10,
                      "embedded": false,
                      "targetType": "Query",
                      "paginated": true,
                      "direction": "both",
                      "mode": "SinglePage"
                  },

                  "raw": ` + "`" + `query TestQuery($after: String, $before: String, $first: Int = 10, $last: Int) {
                  usersByCursor(after: $after, before: $before, first: $first, last: $last) {
                      edges {
                          node {
                              firstName
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
              }
              ` + "`" + `,

                  "rootType": "Query",
                  "stripVariables": [],

                  "selection": {
                      "fields": {
                          "usersByCursor": {
                              "type": "UserConnection",
                              "keyRaw": "usersByCursor::paginated",

                              "directives": [{
                                  "name": "paginate",
                                  "arguments": {
                                      "name": {
                                          "kind": "StringValue",
                                          "value": "All_Users"
                                      },
                                      "mode": {
                                          "kind": "StringValue",
                                          "value": "SinglePage"
                                      }
                                  }
                              }],

                              "list": {
                                  "name": "All_Users",
                                  "connection": true,
                                  "type": "User"
                              },

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

                              "filters": {
                                  "after": {
                                      "kind": "Variable",
                                      "value": "after"
                                  },
                                  "before": {
                                      "kind": "Variable",
                                      "value": "before"
                                  },
                                  "first": {
                                      "kind": "Variable",
                                      "value": "first"
                                  },
                                  "last": {
                                      "kind": "Variable",
                                      "value": "last"
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

                  "policy": "CacheOrNetwork",
                  "partial": false
              }

              "HoudiniHash=2ab71008736af6ef21d3e5a414af57585acb8921743df58a4f258a88407fd212"

          `),
				},
			},
			{
				Name: "nested abstract fragment on connection",
				Pass: true,
				Input: []string{
					`
            query AnimalQuery {
              animals {
                pageInfo {
                  hasPreviousPage
                  hasNextPage
                  startCursor
                  endCursor
                }
                ...MonkeyList
              }
            }
          `,
					`
            fragment MonkeyList on MonkeyConnection {
              edges {
                node {
                  hasBanana
                }
              }
              ...AnimalList
            }
          `,
					`
            fragment AnimalList on AnimalConnection {
              edges {
                node {
                  id
                  ...AnimalProps
                }
              }
            }
          `,
					`
            fragment AnimalProps on Animal {
              name
            }
          `,
				},
				Extra: map[string]any{
					"AnimalQuery": tests.Dedent(`
              export default {
                  "name": "AnimalQuery",
                  "kind": "HoudiniQuery",
                  "hash": "e76887c811b180334dc6bb6b692d39f0266f892db639d5753996e9c84ab1a4bf",
                  "raw": ` + "`" + `fragment AnimalList on AnimalConnection {
                  edges {
                      node {
                          id
                          ...AnimalProps
                          __typename
                          id
                      }
                      __typename
                  }
                  __typename
              }

              fragment AnimalProps on Animal {
                  name
                  __typename
                  id
              }

              query AnimalQuery {
                  animals {
                      pageInfo {
                          hasPreviousPage
                          hasNextPage
                          startCursor
                          endCursor
                          __typename
                      }
                      ...MonkeyList
                      __typename
                  }
              }

              fragment MonkeyList on MonkeyConnection {
                  edges {
                      node {
                          hasBanana
                          __typename
                          id
                      }
                      __typename
                  }
                  ...AnimalList
                  __typename
              }
              ` + "`" + `,

                  "rootType": "Query",
                  "stripVariables": [],

                  "selection": {
                      "fields": {
                          "animals": {
                              "type": "AnimalConnection",
                              "keyRaw": "animals",
                              "nullable": true,

                              "selection": {
                                  "fields": {
                                      "__typename": {
                                          "type": "String",
                                          "keyRaw": "__typename",
                                          "visible": true,
                                      },

                                      "pageInfo": {
                                          "type": "PageInfo",
                                          "keyRaw": "pageInfo",

                                          "selection": {
                                              "fields": {
                                                  "__typename": {
                                                      "type": "String",
                                                      "keyRaw": "__typename",
                                                      "visible": true,
                                                  },

                                                  "endCursor": {
                                                      "type": "String",
                                                      "keyRaw": "endCursor",
                                                      "nullable": true,
                                                      "visible": true,
                                                  },

                                                  "hasNextPage": {
                                                      "type": "Boolean",
                                                      "keyRaw": "hasNextPage",
                                                      "visible": true,
                                                  },

                                                  "hasPreviousPage": {
                                                      "type": "Boolean",
                                                      "keyRaw": "hasPreviousPage",
                                                      "visible": true,
                                                  },

                                                  "startCursor": {
                                                      "type": "String",
                                                      "keyRaw": "startCursor",
                                                      "nullable": true,
                                                      "visible": true,
                                                  },
                                              },
                                          },

                                          "visible": true,
                                      },
                                  },
                                  "abstractFields": {
                                      "fields": {
                                          "MonkeyConnection": {
                                              "__typename": {
                                                  "type": "String",
                                                  "keyRaw": "__typename",
                                                  "visible": true,
                                              },
                                              "edges": {
                                                  "type": "MonkeyEdge",
                                                  "keyRaw": "edges",

                                                  "selection": {
                                                      "fields": {
                                                          "__typename": {
                                                              "type": "String",
                                                              "keyRaw": "__typename",
                                                          },

                                                          "node": {
                                                              "type": "Monkey",
                                                              "keyRaw": "node",
                                                              "nullable": true,

                                                              "selection": {
                                                                  "fields": {
                                                                      "__typename": {
                                                                          "type": "String",
                                                                          "keyRaw": "__typename",
                                                                      },

                                                                      "hasBanana": {
                                                                          "type": "Boolean",
                                                                          "keyRaw": "hasBanana",
                                                                      },

                                                                      "id": {
                                                                          "type": "ID",
                                                                          "keyRaw": "id",
                                                                      },

                                                                      "name": {
                                                                          "type": "String",
                                                                          "keyRaw": "name",
                                                                      },
                                                                  },

                                                                  "fragments": {
                                                                      "AnimalProps": {
                                                                          "arguments": {}
                                                                      },
                                                                  },
                                                              },

                                                          },
                                                      },
                                                  },

                                              },
                                              "pageInfo": {
                                                  "type": "PageInfo",
                                                  "keyRaw": "pageInfo",

                                                  "selection": {
                                                      "fields": {
                                                          "__typename": {
                                                              "type": "String",
                                                              "keyRaw": "__typename",
                                                              "visible": true,
                                                          },

                                                          "endCursor": {
                                                              "type": "String",
                                                              "keyRaw": "endCursor",
                                                              "nullable": true,
                                                              "visible": true,
                                                          },

                                                          "hasNextPage": {
                                                              "type": "Boolean",
                                                              "keyRaw": "hasNextPage",
                                                              "visible": true,
                                                          },

                                                          "hasPreviousPage": {
                                                              "type": "Boolean",
                                                              "keyRaw": "hasPreviousPage",
                                                              "visible": true,
                                                          },

                                                          "startCursor": {
                                                              "type": "String",
                                                              "keyRaw": "startCursor",
                                                              "nullable": true,
                                                              "visible": true,
                                                          },
                                                      },
                                                  },

                                                  "visible": true,
                                              },
                                          },
                                      },

                                      "typeMap": {},
                                  },

                                  "fragments": {
                                      "AnimalList": {
                                          "arguments": {}
                                      },
                                      "MonkeyList": {
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

              "HoudiniHash=e76887c811b180334dc6bb6b692d39f0266f892db639d5753996e9c84ab1a4bf"
          `),
				},
			},
			{
				Name: "fragment variables are embedded in artifact",
				Pass: true,
				Input: []string{
					`
            query AnimalsOverview {
              animals {
                ...AnimalsOverviewList
              }
            }
          `,
					`
            fragment AnimalsOverviewList on AnimalConnection {
              edges {
                node {
                  ... on Monkey {
                    ...MonkeyFragment
                  }
                }
              }
            }
          `,
					`
            fragment MonkeyFragment on Monkey {
              id
              name
              hasBanana
            }
          `,
				},
				Extra: map[string]any{
					"AnimalsOverview": tests.Dedent(`
              export default {
                  "name": "AnimalsOverview",
                  "kind": "HoudiniQuery",
                  "hash": "9e4e0eccf7705d19f99168a9cee083cb3b0c442987f8de2fb32af0c419d9268f",
                  "raw": ` + "`" + `query AnimalsOverview {
                  animals {
                      ...AnimalsOverviewList
                      __typename
                  }
              }

              fragment AnimalsOverviewList on AnimalConnection {
                  edges {
                      node {
                          ... on Monkey {
                              ...MonkeyFragment
                              __typename
                              id
                          }
                          __typename
                          id
                      }
                      __typename
                  }
                  __typename
              }

              fragment MonkeyFragment on Monkey {
                  id
                  name
                  hasBanana
                  __typename
                  id
              }
              ` + "`" + `,

                  "rootType": "Query",
                  "stripVariables": [],

                  "selection": {
                      "fields": {
                          "animals": {
                              "type": "AnimalConnection",
                              "keyRaw": "animals",
                              "nullable": true,

                              "selection": {
                                  "fields": {
                                      "__typename": {
                                          "type": "String",
                                          "keyRaw": "__typename",
                                          "visible": true,
                                      },

                                      "edges": {
                                          "type": "AnimalEdge",
                                          "keyRaw": "edges",

                                          "selection": {
                                              "fields": {
                                                  "__typename": {
                                                      "type": "String",
                                                      "keyRaw": "__typename",
                                                  },

                                                  "node": {
                                                      "type": "Animal",
                                                      "keyRaw": "node",
                                                      "nullable": true,

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
                                                                  "Monkey": {
                                                                      "__typename": {
                                                                          "type": "String",
                                                                          "keyRaw": "__typename",
                                                                      },
                                                                      "hasBanana": {
                                                                          "type": "Boolean",
                                                                          "keyRaw": "hasBanana",
                                                                      },
                                                                      "id": {
                                                                          "type": "ID",
                                                                          "keyRaw": "id",
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
                                                              "MonkeyFragment": {
                                                                  "arguments": {}
                                                              },
                                                          },
                                                      },

                                                      "abstract": true,
                                                  },
                                              },
                                          },

                                          "abstract": true,
                                      },
                                  },

                                  "fragments": {
                                      "AnimalsOverviewList": {
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

              "HoudiniHash=9e4e0eccf7705d19f99168a9cee083cb3b0c442987f8de2fb32af0c419d9268f"
        `),
				},
			},
			{
				Name: "list of fragment unions",
				Pass: true,
				Input: []string{
					`query Entities {
            entities @list(name: "list_entities") {
              ... on User {
                name
              }
              ... on Cat {
                name
              }
            }
          }`,
					`mutation CatMutation {
            catMutation {
              ...list_entities_insert
            }
          }`,
				},
				Extra: map[string]any{
					"Entities": tests.Dedent(`
              export default {
                  "name": "Entities",
                  "kind": "HoudiniQuery",
                  "hash": "0780776e735ef956acb43484910401ac645b29582b83432084ee8717a48d01da",
                  "raw": ` + "`" + `query Entities {
                  entities {
                      ... on User {
                          name
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
              }
              ` + "`" + `,

                  "rootType": "Query",
                  "stripVariables": [],

                  "selection": {
                      "fields": {
                          "entities": {
                              "type": "Entity",
                              "keyRaw": "entities",

                              "directives": [{
                                  "name": "list",
                                  "arguments": {
                                      "name": {
                                          "kind": "StringValue",
                                          "value": "list_entities"
                                      }
                                  }
                              }],

                              "list": {
                                  "name": "list_entities",
                                  "connection": false,
                                  "type": "Entity"
                              },

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

              "HoudiniHash=0780776e735ef956acb43484910401ac645b29582b83432084ee8717a48d01da"
            `),
				},
			},
		},
	})
}
