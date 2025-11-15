package artifacts_test

import (
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins/tests"
)

func TestListArtifacts(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniCore]{
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
        monkeys: MonkeyConnection!
      }

      type User implements Entity & Node {
        id: ID!
        name: String!
        firstName: String!
    friendsByCursor(first: Int, last: Int, before: String, after: String, filter: String): UserConnection
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

      interface Node {
        id: ID!
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
              const artifact = {
                  "name": "TestQuery",
                  "kind": "HoudiniQuery",
                  "hash": "dc502dd533f31553a3c311a7aaa782d82f81d7f7a8816d5095f96584a7600004",

                  "refetch": {
                      "path": ["users"],
                      "method": "offset",
                      "pageSize": 0,
                      "embedded": false,
                      "targetType": "Query",
                      "paginated": false,
                      "direction": "forward",
                      "mode": "Infinite"
                  },

                  "raw": ` + "`" + `query TestQuery($value: String!) {
    users(boolValue: true, floatValue: 1.2, intValue: 1, stringValue: $value) {
        firstName
        __typename
        id
    }
}
` + "`" + `,

                  "rootType": "Query",
                  "stripVariables": [] as Array<string>,

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
                                      },

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
              } as const

              export default artifact

              export type TestQuery = {
              	readonly "input": TestQuery$input;
              	readonly "result": TestQuery$result | undefined;
              };

              export type TestQuery$result = {
              	readonly users: ({
              		readonly firstName: string;
              	})[];
              };

              export type TestQuery$input = {
              	value: string;
              };

              export type TestQuery$artifact = typeof artifact

              "HoudiniHash=dc502dd533f31553a3c311a7aaa782d82f81d7f7a8816d5095f96584a7600004"

          `),
				},
			},
			{
				Name: "list gets refetch spec",
				Pass: true,
				Input: []string{
					`query TestQuery {
            usersByCursor @list(name: "All_Users") {
              edges {
                node {
                  firstName
                }
              }
            }
          }`,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`const artifact = {
    "name": "TestQuery",
    "kind": "HoudiniQuery",
    "hash": "601c84fb968090be239b4de6aabf1493ddd5723c0a3ce6f21a4cef0588c74d7a",

    "refetch": {
        "path": ["usersByCursor"],
        "method": "cursor",
        "pageSize": 0,
        "embedded": false,
        "targetType": "Query",
        "paginated": false,
        "direction": "forward",
        "mode": "Infinite"
    },

    "raw": ` + "`" + `query TestQuery {
    usersByCursor {
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
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "usersByCursor": {
                "type": "UserConnection",
                "keyRaw": "usersByCursor",

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
                    "connection": true,
                    "type": "User"
                },

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "edges": {
                            "type": "UserEdge",
                            "keyRaw": "edges",

                            "selection": {
                                "fields": {
                                    "__typename": {
                                        "type": "String",
                                        "keyRaw": "__typename",
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
                                                },

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

                "visible": true,
            },
        },
    },

    "pluginData": {},
    "policy": "CacheOrNetwork",
    "partial": false
} as const

export default artifact

export type TestQuery = {
	readonly "input"?: TestQuery$input;
	readonly "result": TestQuery$result | undefined;
};

export type TestQuery$result = {
	readonly usersByCursor: {
		readonly edges: ({
			readonly node: {
				readonly firstName: string;
			} | null;
			readonly cursor: string;
		})[];
		readonly pageInfo: {
			readonly hasNextPage: boolean;
			readonly hasPreviousPage: boolean;
			readonly startCursor: string | null;
			readonly endCursor: string | null;
		};
	};
};

export type TestQuery$input = null | undefined;

export type TestQuery$artifact = typeof artifact

"HoudiniHash=601c84fb968090be239b4de6aabf1493ddd5723c0a3ce6f21a4cef0588c74d7a"`),
				},
			},
			{
				Name: "tracks paginate name",
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
					"TestQuery": tests.Dedent(`const artifact = {
    "name": "TestQuery",
    "kind": "HoudiniQuery",
    "hash": "2ab71008736af6ef21d3e5a414af57585acb8921743df58a4f258a88407fd212",

    "refetch": {
        "path": ["usersByCursor"],
        "method": "cursor",
        "pageSize": 10,
        "embedded": false,
        "targetType": "Query",
        "paginated": false,
        "direction": "forward",
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
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "usersByCursor": {
                "type": "UserConnection",
                "keyRaw": "usersByCursor(after: $after, before: $before, first: $first, last: $last)",

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
                        },

                        "edges": {
                            "type": "UserEdge",
                            "keyRaw": "edges",

                            "selection": {
                                "fields": {
                                    "__typename": {
                                        "type": "String",
                                        "keyRaw": "__typename",
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
                                                },

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
} as const

export default artifact

export type TestQuery = {
	readonly "input": TestQuery$input;
	readonly "result": TestQuery$result | undefined;
};

export type TestQuery$result = {
	readonly usersByCursor: {
		readonly edges: ({
			readonly node: {
				readonly firstName: string;
			} | null;
			readonly cursor: string;
		})[];
		readonly pageInfo: {
			readonly hasNextPage: boolean;
			readonly hasPreviousPage: boolean;
			readonly startCursor: string | null;
			readonly endCursor: string | null;
		};
	};
};

export type TestQuery$input = {
	after?: string | null;
	before?: string | null;
	first?: number | null;
	last?: number | null;
};

export type TestQuery$artifact = typeof artifact

"HoudiniHash=2ab71008736af6ef21d3e5a414af57585acb8921743df58a4f258a88407fd212"`),
				},
			},
			{
				Name: "tracks paginate mode",
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
					"TestQuery": tests.Dedent(`const artifact = {
    "name": "TestQuery",
    "kind": "HoudiniQuery",
    "hash": "2ab71008736af6ef21d3e5a414af57585acb8921743df58a4f258a88407fd212",

    "refetch": {
        "path": ["usersByCursor"],
        "method": "cursor",
        "pageSize": 10,
        "embedded": false,
        "targetType": "Query",
        "paginated": false,
        "direction": "forward",
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
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "usersByCursor": {
                "type": "UserConnection",
                "keyRaw": "usersByCursor(after: $after, before: $before, first: $first, last: $last)",

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
                        },

                        "edges": {
                            "type": "UserEdge",
                            "keyRaw": "edges",

                            "selection": {
                                "fields": {
                                    "__typename": {
                                        "type": "String",
                                        "keyRaw": "__typename",
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
                                                },

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
} as const

export default artifact

export type TestQuery = {
	readonly "input": TestQuery$input;
	readonly "result": TestQuery$result | undefined;
};

export type TestQuery$result = {
	readonly usersByCursor: {
		readonly edges: ({
			readonly node: {
				readonly firstName: string;
			} | null;
			readonly cursor: string;
		})[];
		readonly pageInfo: {
			readonly hasNextPage: boolean;
			readonly hasPreviousPage: boolean;
			readonly startCursor: string | null;
			readonly endCursor: string | null;
		};
	};
};

export type TestQuery$input = {
	after?: string | null;
	before?: string | null;
	first?: number | null;
	last?: number | null;
};

export type TestQuery$artifact = typeof artifact

"HoudiniHash=2ab71008736af6ef21d3e5a414af57585acb8921743df58a4f258a88407fd212"`),
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
					"AnimalQuery": tests.Dedent(`const artifact = {
    "name": "AnimalQuery",
    "kind": "HoudiniQuery",
    "hash": "4f37a478d045b157f6b5a17228a3e63b13351e87346407203c9620b7f3ed5e40",
    "raw": ` + "`" + `fragment AnimalList on AnimalConnection {
    edges {
        node {
            id
            ...AnimalProps
            __typename
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
    "stripVariables": [] as Array<string>,

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
                        },

                        "pageInfo": {
                            "type": "PageInfo",
                            "keyRaw": "pageInfo",

                            "selection": {
                                "fields": {
                                    "__typename": {
                                        "type": "String",
                                        "keyRaw": "__typename",
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
                                                            "visible": true,
                                                        },

                                                        "id": {
                                                            "type": "ID",
                                                            "keyRaw": "id",
                                                        },

                                                        "name": {
                                                            "type": "String",
                                                            "keyRaw": "name",
                                                            "visible": true,
                                                        },
                                                    },

                                                    "fragments": {
                                                        "AnimalProps": {
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
                                "pageInfo": {
                                    "type": "PageInfo",
                                    "keyRaw": "pageInfo",

                                    "selection": {
                                        "fields": {
                                            "__typename": {
                                                "type": "String",
                                                "keyRaw": "__typename",
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
} as const

export default artifact

export type AnimalQuery = {
	readonly "input"?: AnimalQuery$input;
	readonly "result": AnimalQuery$result | undefined;
};

export type AnimalQuery$result = {
	readonly animals: {
		readonly pageInfo: {
			readonly hasPreviousPage: boolean;
			readonly hasNextPage: boolean;
			readonly startCursor: string | null;
			readonly endCursor: string | null;
		};
		readonly " $fragments": {
			MonkeyList: {};
		};
	} | null;
};

export type AnimalQuery$input = null | undefined;

export type AnimalQuery$artifact = typeof artifact

"HoudiniHash=4f37a478d045b157f6b5a17228a3e63b13351e87346407203c9620b7f3ed5e40"`),
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
					"AnimalsOverview": tests.Dedent(`const artifact = {
    "name": "AnimalsOverview",
    "kind": "HoudiniQuery",
    "hash": "dde990d4e5db6c676245f47bcc5403e1fcfcfda20e171402deb31e1ee0b50c35",
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
}
` + "`" + `,

    "rootType": "Query",
    "stripVariables": [] as Array<string>,

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

                                            "fragments": {
                                                "MonkeyFragment": {
                                                    "arguments": {}
                                                },
                                            },
                                        },

                                        "abstract": true,
                                        "visible": true,
                                    },
                                },
                            },

                            "abstract": true,
                            "visible": true,
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
} as const

export default artifact

export type AnimalsOverview = {
	readonly "input"?: AnimalsOverview$input;
	readonly "result": AnimalsOverview$result | undefined;
};

export type AnimalsOverview$result = {
	readonly animals: {
		readonly " $fragments": {
			AnimalsOverviewList: {};
		};
	} | null;
};

export type AnimalsOverview$input = null | undefined;

export type AnimalsOverview$artifact = typeof artifact

"HoudiniHash=dde990d4e5db6c676245f47bcc5403e1fcfcfda20e171402deb31e1ee0b50c35"`),
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
					"Entities": tests.Dedent(`const artifact = {
    "name": "Entities",
    "kind": "HoudiniQuery",
    "hash": "0780776e735ef956acb43484910401ac645b29582b83432084ee8717a48d01da",

    "refetch": {
        "path": ["entities"],
        "method": "offset",
        "pageSize": 0,
        "embedded": false,
        "targetType": "Query",
        "paginated": false,
        "direction": "forward",
        "mode": "Infinite"
    },

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
    "stripVariables": [] as Array<string>,

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
                        },

                        "id": {
                            "type": "ID",
                            "keyRaw": "id",
                        },
                    },
                    "abstractFields": {
                        "fields": {
                            "Cat": {
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
                                    "visible": true,
                                },
                            },
                            "User": {
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
} as const

export default artifact

export type Entities = {
	readonly "input"?: Entities$input;
	readonly "result": Entities$result | undefined;
};

export type Entities$result = {
	readonly entities: ({} & (({
		readonly name: string;
		readonly id: string;
		readonly __typename: "Cat";
	}) | ({
		readonly name: string;
		readonly id: string;
		readonly __typename: "User";
	})))[];
};

export type Entities$input = null | undefined;

export type Entities$artifact = typeof artifact

"HoudiniHash=0780776e735ef956acb43484910401ac645b29582b83432084ee8717a48d01da"`),
				},
			},
			{
				Name: "fragments in lists",
				Pass: true,
				Input: []string{
					`query TestQuery {
              usersByCursor @list(name: "All_Users") {
                edges {
                  node {
                    ...UserTest
                  }
                }
              }
            }`,
					`fragment UserTest on User {
              firstName
            }`,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`const artifact = {
    "name": "TestQuery",
    "kind": "HoudiniQuery",
    "hash": "efc384927733daadaff58ef5818480ea7db4f0448a7fa733179fdbfad50b067b",

    "refetch": {
        "path": ["usersByCursor"],
        "method": "cursor",
        "pageSize": 0,
        "embedded": false,
        "targetType": "Query",
        "paginated": false,
        "direction": "forward",
        "mode": "Infinite"
    },

    "raw": ` + "`" + `query TestQuery {
    usersByCursor {
        edges {
            node {
                ...UserTest
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

fragment UserTest on User {
    firstName
    __typename
    id
}
` + "`" + `,

    "rootType": "Query",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "usersByCursor": {
                "type": "UserConnection",
                "keyRaw": "usersByCursor",

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
                    "connection": true,
                    "type": "User"
                },

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "edges": {
                            "type": "UserEdge",
                            "keyRaw": "edges",

                            "selection": {
                                "fields": {
                                    "__typename": {
                                        "type": "String",
                                        "keyRaw": "__typename",
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
                                                },

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
                                                "UserTest": {
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

                        "pageInfo": {
                            "type": "PageInfo",
                            "keyRaw": "pageInfo",

                            "selection": {
                                "fields": {
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

                "visible": true,
            },
        },
    },

    "pluginData": {},
    "policy": "CacheOrNetwork",
    "partial": false
} as const

export default artifact

export type TestQuery = {
	readonly "input"?: TestQuery$input;
	readonly "result": TestQuery$result | undefined;
};

export type TestQuery$result = {
	readonly usersByCursor: {
		readonly edges: ({
			readonly node: {
				readonly " $fragments": {
					UserTest: {};
				};
			} | null;
			readonly cursor: string;
		})[];
		readonly pageInfo: {
			readonly hasNextPage: boolean;
			readonly hasPreviousPage: boolean;
			readonly startCursor: string | null;
			readonly endCursor: string | null;
		};
	};
};

export type TestQuery$input = null | undefined;

export type TestQuery$artifact = typeof artifact

"HoudiniHash=efc384927733daadaff58ef5818480ea7db4f0448a7fa733179fdbfad50b067b"`),
				},
			},
		},
	})
}
