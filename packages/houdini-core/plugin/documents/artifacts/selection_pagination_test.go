package artifacts_test

import (
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins/tests"
)

func TestPaginationArtifacts(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniCore]{
		Schema: `
      scalar Cursor

      type Query {
        users: [User!]!
        user: User!
				entitiesByCursor(first: Int, after: String, last: Int, before: String): EntityConnection!
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

			type Ghost {
				name: String!
				aka: String!
				believers: [User!]!
				friends: [Ghost!]!
				cats: [Cat!]!
			}

			type Cat {
				id: ID!
				"""
				The name of the cat
				"""
				name: String!
				owner: User!
			}

			type EntityEdge {
				cursor: String!
				node: Entity
			}

			type EntityConnection {
				pageInfo: PageInfo!
				edges: [EntityEdge!]!
			}

			union Entity = User | Cat | Ghost
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
					"PaginatedFragment": tests.Dedent(`const artifact = {
    "name": "PaginatedFragment",
    "kind": "HoudiniFragment",
    "hash": "984a385c590d094c53d7c6fb08bcabddd2f0cbfd0df69d49b3743fd0e046a66b",

    "refetch": {
        "path": ["friendsByCursor"],
        "method": "cursor",
        "pageSize": 10,
        "embedded": true,
        "targetType": "User",
        "paginated": false,
        "direction": "forward",
        "mode": "Infinite"
    },

    "raw": ` + "`" + `fragment PaginatedFragment on User {
    friendsByCursor(filter: "hello", first: 10) {
        edges {
            node {
                id
                __typename
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
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "__typename": {
                "type": "String",
                "keyRaw": "__typename",
                "visible": true,
            },

            "friendsByCursor": {
                "type": "UserConnection",
                "keyRaw": "friendsByCursor(filter: \"hello\", first: 10)",
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

            "id": {
                "type": "ID",
                "keyRaw": "id",
                "visible": true,
            },
        },
    },

    "pluginData": {},
} as const

export default artifact

export type PaginatedFragment$input = never;

export type PaginatedFragment = {
	readonly "shape"?: PaginatedFragment$data;
	readonly " $fragments": {
		"PaginatedFragment": any;
	};
};

export type PaginatedFragment$data = {
	readonly friendsByCursor: {
		readonly edges: ({
			readonly node: {
				readonly id: string;
			} | null;
			readonly cursor: string;
		})[];
		readonly pageInfo: {
			readonly hasNextPage: boolean;
			readonly hasPreviousPage: boolean;
			readonly startCursor: string | null;
			readonly endCursor: string | null;
		};
	} | null;
};

export type PaginatedFragment$artifact = typeof artifact

"HoudiniHash=984a385c590d094c53d7c6fb08bcabddd2f0cbfd0df69d49b3743fd0e046a66b"`),
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
					"PaginatedFragment": tests.Dedent(`const artifact = {
    "name": "PaginatedFragment",
    "kind": "HoudiniFragment",
    "hash": "984a385c590d094c53d7c6fb08bcabddd2f0cbfd0df69d49b3743fd0e046a66b",

    "refetch": {
        "path": ["friendsByCursor"],
        "method": "cursor",
        "pageSize": 10,
        "embedded": true,
        "targetType": "User",
        "paginated": false,
        "direction": "forward",
        "mode": "SinglePage"
    },

    "raw": ` + "`" + `fragment PaginatedFragment on User {
    friendsByCursor(filter: "hello", first: 10) {
        edges {
            node {
                id
                __typename
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
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "__typename": {
                "type": "String",
                "keyRaw": "__typename",
                "visible": true,
            },

            "friendsByCursor": {
                "type": "UserConnection",
                "keyRaw": "friendsByCursor(filter: \"hello\", first: 10)",
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

            "id": {
                "type": "ID",
                "keyRaw": "id",
                "visible": true,
            },
        },
    },

    "pluginData": {},
} as const

export default artifact

export type PaginatedFragment$input = never;

export type PaginatedFragment = {
	readonly "shape"?: PaginatedFragment$data;
	readonly " $fragments": {
		"PaginatedFragment": any;
	};
};

export type PaginatedFragment$data = {
	readonly friendsByCursor: {
		readonly edges: ({
			readonly node: {
				readonly id: string;
			} | null;
			readonly cursor: string;
		})[];
		readonly pageInfo: {
			readonly hasNextPage: boolean;
			readonly hasPreviousPage: boolean;
			readonly startCursor: string | null;
			readonly endCursor: string | null;
		};
	} | null;
};

export type PaginatedFragment$artifact = typeof artifact

"HoudiniHash=984a385c590d094c53d7c6fb08bcabddd2f0cbfd0df69d49b3743fd0e046a66b"`),
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
					"PaginatedFragment": tests.Dedent(`const artifact = {
    "name": "PaginatedFragment",
    "kind": "HoudiniFragment",
    "hash": "3da994a95a263e64c158d256500bc9339f871692f1943d6f4c1e45aeecbeea2d",

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
    friendsByOffset(filter: "hello", limit: 10) {
        id
        __typename
    }
    __typename
    id
}
` + "`" + `,

    "rootType": "User",
    "stripVariables": [] as Array<string>,

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
} as const

export default artifact

export type PaginatedFragment$input = never;

export type PaginatedFragment = {
	readonly "shape"?: PaginatedFragment$data;
	readonly " $fragments": {
		"PaginatedFragment": any;
	};
};

export type PaginatedFragment$data = {
	readonly friendsByOffset: ({
		readonly id: string;
	})[];
};

export type PaginatedFragment$artifact = typeof artifact

"HoudiniHash=3da994a95a263e64c158d256500bc9339f871692f1943d6f4c1e45aeecbeea2d"`),
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
					"ScalarPagination": tests.Dedent(`const artifact = {
    "name": "ScalarPagination",
    "kind": "HoudiniQuery",
    "hash": "7f2262dcaf136ea17500364d6ca7be04eca17f9950a9177287240aba89d8f8e7",

    "refetch": {
        "path": ["user","friendsByCursorScalar"],
        "method": "cursor",
        "pageSize": 10,
        "embedded": false,
        "targetType": "Query",
        "paginated": false,
        "direction": "forward",
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
    "stripVariables": [] as Array<string>,

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
                        },

                        "friendsByCursorScalar": {
                            "type": "UserConnection",
                            "keyRaw": "friendsByCursorScalar(after: $after, before: $before, filter: \"hello\", first: $first, last: $last)",

                            "directives": [{
                                "name": "paginate",
                                "arguments": {}
                            }],


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

                                                            "friendsByCursor": {
                                                                "type": "UserConnection",
                                                                "keyRaw": "friendsByCursor",
                                                                "nullable": true,

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
} as const

export default artifact

export type ScalarPagination = {
	readonly "input": ScalarPagination$input;
	readonly "result": ScalarPagination$result | undefined;
};

export type ScalarPagination$result = {
	readonly user: {
		readonly friendsByCursorScalar: {
			readonly edges: ({
				readonly node: {
					readonly friendsByCursor: {
						readonly edges: ({
							readonly node: {
								readonly id: string;
							} | null;
						})[];
					} | null;
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
};

export type ScalarPagination$input = {
	after?: Cursor | null;
	before?: Cursor | null;
	first?: number | null;
	last?: number | null;
};

export type ScalarPagination$artifact = typeof artifact

"HoudiniHash=7f2262dcaf136ea17500364d6ca7be04eca17f9950a9177287240aba89d8f8e7"`),
				},
			},
			{
				Name: "sibling aliases don't get marked",
				Input: []string{
					`
              fragment PaginatedFragment on User {
                  friendsByCursor(first:10, filter: "hello") @paginate {
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
                  friends: friendsByCursor(first:10, filter: "hello") {
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
          `,
				},
				Pass: true,
				Extra: map[string]any{
					"PaginatedFragment": tests.Dedent(`const artifact = {
    "name": "PaginatedFragment",
    "kind": "HoudiniFragment",
    "hash": "284c586ae2cb137877c64127e51f7278ece65613b171ea54d035e759b271f035",

    "refetch": {
        "path": ["friendsByCursor"],
        "method": "cursor",
        "pageSize": 10,
        "embedded": true,
        "targetType": "User",
        "paginated": false,
        "direction": "forward",
        "mode": "Infinite"
    },

    "raw": ` + "`" + `fragment PaginatedFragment on User {
    friendsByCursor(filter: "hello", first: 10) {
        edges {
            node {
                friendsByCursor {
                    edges {
                        node {
                            id
                            __typename
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
    friends: friendsByCursor(filter: "hello", first: 10) {
        edges {
            node {
                friendsByCursor {
                    edges {
                        node {
                            id
                            __typename
                        }
                        __typename
                    }
                    __typename
                }
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
` + "`" + `,

    "rootType": "User",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "__typename": {
                "type": "String",
                "keyRaw": "__typename",
                "visible": true,
            },

            "friends": {
                "type": "UserConnection",
                "keyRaw": "friends(filter: \"hello\", first: 10)",
                "nullable": true,

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

                                                "friendsByCursor": {
                                                    "type": "UserConnection",
                                                    "keyRaw": "friendsByCursor",
                                                    "nullable": true,

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

            "friendsByCursor": {
                "type": "UserConnection",
                "keyRaw": "friendsByCursor(filter: \"hello\", first: 10)",
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

                                                "friendsByCursor": {
                                                    "type": "UserConnection",
                                                    "keyRaw": "friendsByCursor",
                                                    "nullable": true,

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

            "id": {
                "type": "ID",
                "keyRaw": "id",
                "visible": true,
            },
        },
    },

    "pluginData": {},
} as const

export default artifact

export type PaginatedFragment$input = never;

export type PaginatedFragment = {
	readonly "shape"?: PaginatedFragment$data;
	readonly " $fragments": {
		"PaginatedFragment": any;
	};
};

export type PaginatedFragment$data = {
	readonly friendsByCursor: {
		readonly edges: ({
			readonly node: {
				readonly friendsByCursor: {
					readonly edges: ({
						readonly node: {
							readonly id: string;
						} | null;
					})[];
				} | null;
			} | null;
			readonly cursor: string;
		})[];
		readonly pageInfo: {
			readonly hasNextPage: boolean;
			readonly hasPreviousPage: boolean;
			readonly startCursor: string | null;
			readonly endCursor: string | null;
		};
	} | null;
	readonly friends: {
		readonly edges: ({
			readonly node: {
				readonly friendsByCursor: {
					readonly edges: ({
						readonly node: {
							readonly id: string;
						} | null;
					})[];
				} | null;
			} | null;
		})[];
	} | null;
};

export type PaginatedFragment$artifact = typeof artifact

"HoudiniHash=284c586ae2cb137877c64127e51f7278ece65613b171ea54d035e759b271f035"`),
				},
			},
			{
				Name: "paginate over unions",
				Input: []string{
					`
            query TestQuery {
              entitiesByCursor(first: 10) @paginate(name: "All_Users") {
                edges {
                  node {
                    ... on User {
                      firstName
                    }
                  }
                }
              }
            }
          `,
				},
				Pass: true,
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`const artifact = {
    "name": "TestQuery",
    "kind": "HoudiniQuery",
    "hash": "0d0fa55060035d4eb6ae7de938bdcfe8703aecff0becc0a479b6e29ffa999e4b",

    "refetch": {
        "path": ["entitiesByCursor"],
        "method": "cursor",
        "pageSize": 10,
        "embedded": false,
        "targetType": "Query",
        "paginated": false,
        "direction": "forward",
        "mode": "Infinite"
    },

    "raw": ` + "`" + `query TestQuery($after: String, $before: String, $first: Int = 10, $last: Int) {
    entitiesByCursor(after: $after, before: $before, first: $first, last: $last) {
        edges {
            node {
                ... on User {
                    firstName
                    __typename
                    id
                }
                __typename
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
            "entitiesByCursor": {
                "type": "EntityConnection",
                "keyRaw": "entitiesByCursor(after: $after, before: $before, first: $first, last: $last)",

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
                    "type": "Entity"
                },

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "edges": {
                            "type": "EntityEdge",
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
                                        "type": "Entity",
                                        "keyRaw": "node",
                                        "nullable": true,

                                        "selection": {
                                            "fields": {
                                                "__typename": {
                                                    "type": "String",
                                                    "keyRaw": "__typename",
                                                },
                                            },
                                            "abstractFields": {
                                                "fields": {
                                                    "User": {
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

                                                "typeMap": {},
                                            },
                                        },

                                        "abstract": true,
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
	readonly entitiesByCursor: {
		readonly edges: ({
			readonly node: {} & (({
		readonly firstName: string;
		readonly id: string;
		readonly __typename: "User";
	}) | ({
		readonly __typename: "non-exhaustive; don't match this";
	})) | null;
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

"HoudiniHash=0d0fa55060035d4eb6ae7de938bdcfe8703aecff0becc0a479b6e29ffa999e4b"`),
				},
			},
		},
	})
}
