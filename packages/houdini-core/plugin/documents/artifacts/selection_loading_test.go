package artifacts_test

import (
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins/tests"
)

func TestLoadingArtifacts(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig]{
		Schema: `
      type Query { 
				animals(first: Int, after: String): AnimalConnection
        monkeys: MonkeyConnection!
				catOwners: [CatOwner!]!
				entities: [Entity!]!
        entity: Entity!
      }

			union Entity = User | Cat | Ghost

			interface Animal {
				id: ID!
				name: String!
			}

			type Monkey implements Animal {
				id: ID!
				name: String!
				hasBanana: Boolean!
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

			type User implements CatOwner {
				id: ID!
        firstName: String!
				cats: [Cat!]!
      }

    	type Ghost implements CatOwner {
				name: String!
				cats: [Cat!]!
      }

			interface CatOwner {
				cats: [Cat!]!
			}

      type Cat { 
        id: ID!
        name: String!
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
    `,
		PerformTest: performArtifactTest,
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "persists loading behavior in selection",
				Pass: true,
				Input: []string{
					`
            query MonkeyListQuery {
              monkeys @loading {
                pageInfo @loading {
                  hasPreviousPage
                  hasNextPage
                  startCursor
                  endCursor
                }
                ...AnimalsList @loading
              }
            }
          `,
					`
            fragment AnimalsList on AnimalConnection {
              edges {
                node {
                  id
                  name
                }
              }
            }
          `,
				},
				Extra: map[string]any{
					"MonkeyListQuery": tests.Dedent(`
              export default {
                  "name": "MonkeyListQuery",
                  "kind": "HoudiniQuery",
                  "hash": "b854c12725a2f322fb6a2de8c63e41c90cd702cc48a4e3f8afedef1d537a4d22",
                  "raw": ` + "`" + `fragment AnimalsList on AnimalConnection {
                  edges {
                      node {
                          id
                          name
                          __typename
                          id
                      }
                      __typename
                  }
                  __typename
              }

              query MonkeyListQuery {
                  monkeys {
                      pageInfo {
                          hasPreviousPage
                          hasNextPage
                          startCursor
                          endCursor
                          __typename
                      }
                      ...AnimalsList
                      __typename
                  }
              }
              ` + "`" + `,

                  "rootType": "Query",
                  "stripVariables": [],

                  "selection": {
                      "fields": {
                          "monkeys": {
                              "type": "MonkeyConnection",
                              "keyRaw": "monkeys",

                              "directives": [{
                                  "name": "loading",
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

                                                              "name": {
                                                                  "type": "String",
                                                                  "keyRaw": "name",
                                                              },
                                                          },
                                                      },

                                                      "abstract": true,
                                                  },
                                              },
                                          },

                                          "abstract": true,
                                      },

                                      "pageInfo": {
                                          "type": "PageInfo",
                                          "keyRaw": "pageInfo",

                                          "directives": [{
                                              "name": "loading",
                                              "arguments": {}
                                          }],


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

                                          "loading": {
                                              "kind": "value",
                                          },
                                          "visible": true,
                                      },
                                  },

                                  "fragments": {
                                      "AnimalsList": {
                                          "arguments": {},
                                          "loading": true,
                                      },
                                  },
                              },

                              "loading": {
                                  "kind": "continue",
                              },
                              "visible": true,
                          },
                      },
                  },

                  "pluginData": {},
                  "enableLoadingState": "local",
                  "policy": "CacheOrNetwork",
                  "partial": false
              }

              "HoudiniHash=b854c12725a2f322fb6a2de8c63e41c90cd702cc48a4e3f8afedef1d537a4d22"
            `),
				},
			},
			{
				Name: "loading state on mixed abstract type",
				Pass: true,
				Input: []string{
					`query Query {
            catOwners @loading {
              cats @loading{
                id @loading
              }
              ... on User @loading {
                firstName @loading
              }
            }
          }`,
				},
				Extra: map[string]any{
					"Query": tests.Dedent(`
              export default {
                  "name": "Query",
                  "kind": "HoudiniQuery",
                  "hash": "d38fc2f78d9b0433bc344712aa95be6209427b49e5780c2719dc66cd22ebb8da",
                  "raw": ` + "`" + `query Query {
                  catOwners {
                      cats {
                          id
                          __typename
                          id
                      }
                      ... on User {
                          firstName
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
                          "catOwners": {
                              "type": "CatOwner",
                              "keyRaw": "catOwners",

                              "directives": [{
                                  "name": "loading",
                                  "arguments": {}
                              }],


                              "selection": {
                                  "fields": {
                                      "__typename": {
                                          "type": "String",
                                          "keyRaw": "__typename",
                                          "visible": true,
                                      },

                                      "cats": {
                                          "type": "Cat",
                                          "keyRaw": "cats",

                                          "directives": [{
                                              "name": "loading",
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

                                                      "directives": [{
                                                          "name": "loading",
                                                          "arguments": {}
                                                      }],

                                                      "loading": {
                                                          "kind": "value",
                                                      },
                                                      "visible": true,
                                                  },
                                              },
                                          },

                                          "loading": {
                                              "kind": "continue",
                                              "list": {
                                                  "depth": 1,
                                                  "count": 3,
                                              },
                                          },
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
                                              "cats": {
                                                  "type": "Cat",
                                                  "keyRaw": "cats",

                                                  "directives": [{
                                                      "name": "loading",
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

                                                              "directives": [{
                                                                  "name": "loading",
                                                                  "arguments": {}
                                                              }],

                                                              "loading": {
                                                                  "kind": "value",
                                                              },
                                                              "visible": true,
                                                          },
                                                      },
                                                  },

                                                  "loading": {
                                                      "kind": "continue",
                                                      "list": {
                                                          "depth": 1,
                                                          "count": 3,
                                                      },
                                                  },
                                                  "visible": true,
                                              },
                                              "firstName": {
                                                  "type": "String",
                                                  "keyRaw": "firstName",

                                                  "directives": [{
                                                      "name": "loading",
                                                      "arguments": {}
                                                  }],

                                                  "loading": {
                                                      "kind": "value",
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

                                      "typeMap": {},
                                  },

                                  "loadingTypes": ["User"],
                              },

                              "loading": {
                                  "kind": "continue",
                                  "list": {
                                      "depth": 1,
                                      "count": 3,
                                  },
                              },
                              "abstract": true,
                              "visible": true,
                          },
                      },
                  },

                  "pluginData": {},
                  "enableLoadingState": "local",
                  "policy": "CacheOrNetwork",
                  "partial": false
              }

              "HoudiniHash=d38fc2f78d9b0433bc344712aa95be6209427b49e5780c2719dc66cd22ebb8da"
            `),
				},
			},
			{
				Name: "loading state on multiple branches of an abstract selection",
				Pass: true,
				Input: []string{
					`
            query Query {
              entities @loading {
                ... on User @loading {
                  firstName @loading
                }
                ... on Cat @loading {
                  name @loading
                }
              }
            }
          `,
				},
				Extra: map[string]any{
					"Query": tests.Dedent(`
              export default {
                  "name": "Query",
                  "kind": "HoudiniQuery",
                  "hash": "75a077637efd548c3e2b73c0d6ba3a6b0adbf92d3661c3907253b00c250d594a",
                  "raw": ` + "`" + `query Query {
                  entities {
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
                                  "name": "loading",
                                  "arguments": {}
                              }],


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
                                              "name": {
                                                  "type": "String",
                                                  "keyRaw": "name",

                                                  "directives": [{
                                                      "name": "loading",
                                                      "arguments": {}
                                                  }],

                                                  "loading": {
                                                      "kind": "value",
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
                                              "firstName": {
                                                  "type": "String",
                                                  "keyRaw": "firstName",

                                                  "directives": [{
                                                      "name": "loading",
                                                      "arguments": {}
                                                  }],

                                                  "loading": {
                                                      "kind": "value",
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

                                      "typeMap": {},
                                  },

                                  "loadingTypes": ["Cat", "User"],
                              },

                              "loading": {
                                  "kind": "continue",
                                  "list": {
                                      "depth": 1,
                                      "count": 3,
                                  },
                              },
                              "abstract": true,
                              "visible": true,
                          },
                      },
                  },

                  "pluginData": {},
                  "enableLoadingState": "local",
                  "policy": "CacheOrNetwork",
                  "partial": false
              }

              "HoudiniHash=75a077637efd548c3e2b73c0d6ba3a6b0adbf92d3661c3907253b00c250d594a"
            `),
				},
			},
			{
				Name: "loading state on inline fragments",
				Pass: true,
				Input: []string{
					`
            query Query {
              entity @loading {
                          ...Info @loading
              }
            }
          `,
					`
            fragment Info on Entity {
                ... on User @loading {
                    firstName @loading
                }
            }
          `,
				},
				Extra: map[string]any{
					"Query": tests.Dedent(`
              export default {
                  "name": "Query",
                  "kind": "HoudiniQuery",
                  "hash": "5ba953f37cfa2e0ce515c4c22ce9c6e3206fc05adc5c96fbc7a3184691d672f1",
                  "raw": ` + "`" + `fragment Info on Entity {
                  ... on User {
                      firstName
                      __typename
                      id
                  }
                  __typename
              }

              query Query {
                  entity {
                      ...Info
                      __typename
                  }
              }
              ` + "`" + `,

                  "rootType": "Query",
                  "stripVariables": [],

                  "selection": {
                      "fields": {
                          "entity": {
                              "type": "Entity",
                              "keyRaw": "entity",

                              "directives": [{
                                  "name": "loading",
                                  "arguments": {}
                              }],


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

                                                  "directives": [{
                                                      "name": "loading",
                                                      "arguments": {}
                                                  }],

                                                  "loading": {
                                                      "kind": "value",
                                                  },
                                              },
                                              "id": {
                                                  "type": "ID",
                                                  "keyRaw": "id",
                                              },
                                          },
                                      },

                                      "typeMap": {},
                                  },

                                  "fragments": {
                                      "Info": {
                                          "arguments": {},
                                          "loading": true,
                                      },
                                  },

                                  "loadingTypes": ["User"],
                              },

                              "loading": {
                                  "kind": "continue",
                              },
                              "abstract": true,
                              "visible": true,
                          },
                      },
                  },

                  "pluginData": {},
                  "enableLoadingState": "local",
                  "policy": "CacheOrNetwork",
                  "partial": false
              }

              "HoudiniHash=5ba953f37cfa2e0ce515c4c22ce9c6e3206fc05adc5c96fbc7a3184691d672f1"
            `),
				},
			},
			{
				Name: "persist count in loading spec",
				Pass: true,
				Input: []string{
					`
            query Query {
              entities @loading(count: 5) {
                ... on User @loading {
                  firstName @loading
                }
                ... on Cat  {
                  name
                }
              }
            }
          `,
				},
				Extra: map[string]any{
					"Query": tests.Dedent(`
              export default {
                  "name": "Query",
                  "kind": "HoudiniQuery",
                  "hash": "75a077637efd548c3e2b73c0d6ba3a6b0adbf92d3661c3907253b00c250d594a",
                  "raw": ` + "`" + `query Query {
                  entities {
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
                                  "name": "loading",
                                  "arguments": {
                                      "count": {
                                          "kind": "IntValue",
                                          "value": 5
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
                                              "firstName": {
                                                  "type": "String",
                                                  "keyRaw": "firstName",

                                                  "directives": [{
                                                      "name": "loading",
                                                      "arguments": {}
                                                  }],

                                                  "loading": {
                                                      "kind": "value",
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

                                      "typeMap": {},
                                  },

                                  "loadingTypes": ["User"],
                              },

                              "loading": {
                                  "kind": "continue",
                                  "list": {
                                      "depth": 1,
                                      "count": 5,
                                  },
                              },
                              "abstract": true,
                              "visible": true,
                          },
                      },
                  },

                  "pluginData": {},
                  "enableLoadingState": "local",
                  "policy": "CacheOrNetwork",
                  "partial": false
              }

              "HoudiniHash=75a077637efd548c3e2b73c0d6ba3a6b0adbf92d3661c3907253b00c250d594a"
            `),
				},
			},
			{
				Name: "loading state on definitions",
				Pass: true,
				Input: []string{
					`query Query @loading {
            entities {
              ... on User {
                firstName
              }
              ... on Cat  {
                name
              }
            }
          }`,
				},
				Extra: map[string]any{
					"Query": tests.Dedent(`
              export default {
                  "name": "Query",
                  "kind": "HoudiniQuery",
                  "hash": "75a077637efd548c3e2b73c0d6ba3a6b0adbf92d3661c3907253b00c250d594a",
                  "raw": ` + "`" + `query Query {
                  entities {
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
                                          "loading": {
                                              "kind": "value",
                                          },
                                          "visible": true,
                                      },
                                  },
                                  "abstractFields": {
                                      "fields": {
                                          "Cat": {
                                              "__typename": {
                                                  "type": "String",
                                                  "keyRaw": "__typename",
                                                  "loading": {
                                                      "kind": "value",
                                                  },
                                                  "visible": true,
                                              },
                                              "id": {
                                                  "type": "ID",
                                                  "keyRaw": "id",
                                                  "loading": {
                                                      "kind": "value",
                                                  },
                                                  "visible": true,
                                              },
                                              "name": {
                                                  "type": "String",
                                                  "keyRaw": "name",
                                                  "loading": {
                                                      "kind": "value",
                                                  },
                                                  "visible": true,
                                              },
                                          },
                                          "User": {
                                              "__typename": {
                                                  "type": "String",
                                                  "keyRaw": "__typename",
                                                  "loading": {
                                                      "kind": "value",
                                                  },
                                                  "visible": true,
                                              },
                                              "firstName": {
                                                  "type": "String",
                                                  "keyRaw": "firstName",
                                                  "loading": {
                                                      "kind": "value",
                                                  },
                                                  "visible": true,
                                              },
                                              "id": {
                                                  "type": "ID",
                                                  "keyRaw": "id",
                                                  "loading": {
                                                      "kind": "value",
                                                  },
                                                  "visible": true,
                                              },
                                          },
                                      },

                                      "typeMap": {},
                                  },
                              },

                              "loading": {
                                  "kind": "continue",
                                  "list": {
                                      "depth": 1,
                                      "count": 3,
                                  },
                              },
                              "abstract": true,
                              "visible": true,
                          },
                      },
                  },

                  "pluginData": {},
                  "enableLoadingState": "global",
                  "policy": "CacheOrNetwork",
                  "partial": false
              }

              "HoudiniHash=75a077637efd548c3e2b73c0d6ba3a6b0adbf92d3661c3907253b00c250d594a"
            `),
				},
			},
			{
				Name: "loading cascade",
				Pass: true,
				Input: []string{
					`
            query Query {
              entities  @loading (cascade: true) {
                ... on User {
                  firstName
                }
                ... on Cat  {
                  name
                }
              }

              b: entities {
                ... on User {
                  firstName
                }
              }
            }
          `,
				},
				Extra: map[string]any{
					"Query": tests.Dedent(`
              export default {
                  "name": "Query",
                  "kind": "HoudiniQuery",
                  "hash": "8a12a21168a8db7431b74a680bdce400f24aa9c577674893fddbf89c6d0a7877",
                  "raw": ` + "`" + `query Query {
                  entities {
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
                  }
                  b: entities {
                      ... on User {
                          firstName
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
                          "b": {
                              "type": "Entity",
                              "keyRaw": "b",

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
                                              "id": {
                                                  "type": "ID",
                                                  "keyRaw": "id",
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

                          "entities": {
                              "type": "Entity",
                              "keyRaw": "entities",

                              "directives": [{
                                  "name": "loading",
                                  "arguments": {
                                      "cascade": {
                                          "kind": "BooleanValue",
                                          "value": true
                                      }
                                  }
                              }],


                              "selection": {
                                  "fields": {
                                      "__typename": {
                                          "type": "String",
                                          "keyRaw": "__typename",
                                          "loading": {
                                              "kind": "value",
                                          },
                                          "visible": true,
                                      },
                                  },
                                  "abstractFields": {
                                      "fields": {
                                          "Cat": {
                                              "__typename": {
                                                  "type": "String",
                                                  "keyRaw": "__typename",
                                                  "loading": {
                                                      "kind": "value",
                                                  },
                                                  "visible": true,
                                              },
                                              "id": {
                                                  "type": "ID",
                                                  "keyRaw": "id",
                                                  "loading": {
                                                      "kind": "value",
                                                  },
                                                  "visible": true,
                                              },
                                              "name": {
                                                  "type": "String",
                                                  "keyRaw": "name",
                                                  "loading": {
                                                      "kind": "value",
                                                  },
                                                  "visible": true,
                                              },
                                          },
                                          "User": {
                                              "__typename": {
                                                  "type": "String",
                                                  "keyRaw": "__typename",
                                                  "loading": {
                                                      "kind": "value",
                                                  },
                                                  "visible": true,
                                              },
                                              "firstName": {
                                                  "type": "String",
                                                  "keyRaw": "firstName",
                                                  "loading": {
                                                      "kind": "value",
                                                  },
                                                  "visible": true,
                                              },
                                              "id": {
                                                  "type": "ID",
                                                  "keyRaw": "id",
                                                  "loading": {
                                                      "kind": "value",
                                                  },
                                                  "visible": true,
                                              },
                                          },
                                      },

                                      "typeMap": {},
                                  },
                              },

                              "loading": {
                                  "kind": "continue",
                                  "list": {
                                      "depth": 1,
                                      "count": 3,
                                  },
                              },
                              "abstract": true,
                              "visible": true,
                          },
                      },
                  },

                  "pluginData": {},
                  "enableLoadingState": "local",
                  "policy": "CacheOrNetwork",
                  "partial": false
              }

              "HoudiniHash=8a12a21168a8db7431b74a680bdce400f24aa9c577674893fddbf89c6d0a7877"
            `),
				},
			},
		},
	})
}
