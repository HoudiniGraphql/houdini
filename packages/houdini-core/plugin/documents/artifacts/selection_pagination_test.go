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
        species(id: Int!): Species
      }

      type Species {
        id: Int!
        name: String!
        moves(first: Int, after: String): SpeciesMoveConnection!
      }

      type SpeciesMoveConnection {
        edges: [SpeciesMoveEdge!]!
        pageInfo: PageInfo!
      }

      type SpeciesMoveEdge {
        node: SpeciesMove
        cursor: String!
      }

      type SpeciesMove {
        id: Int!
        name: String!
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
        "paginated": true,
        "direction": "both",
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
                                        "updates": ["append"],
                                        "nullable": true,
                                        "visible": true,
                                    },

                                    "hasNextPage": {
                                        "type": "Boolean",
                                        "keyRaw": "hasNextPage",
                                        "updates": ["append"],
                                        "visible": true,
                                    },

                                    "hasPreviousPage": {
                                        "type": "Boolean",
                                        "keyRaw": "hasPreviousPage",
                                        "updates": ["prepend"],
                                        "visible": true,
                                    },

                                    "startCursor": {
                                        "type": "String",
                                        "keyRaw": "startCursor",
                                        "updates": ["prepend"],
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
				Name: "pagination arguments included in key for SinglePage Mode (per-cursor keys, no ::paginated)",
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
        "paginated": true,
        "direction": "both",
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
                "keyRaw": "friendsByCursor(first: 10, after: null, last: null, before: null, filter: \"hello\")",
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
                                                    "updates": ["append"],
                                                    "nullable": true,
                                                    "visible": true,
                                                },

                                                "hasNextPage": {
                                                    "type": "Boolean",
                                                    "keyRaw": "hasNextPage",
                                                    "updates": ["append"],
                                                    "visible": true,
                                                },

                                                "hasPreviousPage": {
                                                    "type": "Boolean",
                                                    "keyRaw": "hasPreviousPage",
                                                    "updates": ["prepend"],
                                                    "visible": true,
                                                },

                                                "startCursor": {
                                                    "type": "String",
                                                    "keyRaw": "startCursor",
                                                    "updates": ["prepend"],
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

export type ScalarPagination$unmasked = {
	readonly user: {
		readonly __typename: "User";
		readonly friendsByCursorScalar: {
			readonly __typename: "UserConnection";
			readonly edges: ({
				readonly __typename: "UserEdge";
				readonly cursor: string;
				readonly node: {
					readonly __typename: "User";
					readonly friendsByCursor: {
						readonly __typename: "UserConnection";
						readonly edges: ({
							readonly __typename: "UserEdge";
							readonly node: {
								readonly __typename: "User";
								readonly id: string;
							} | null;
						})[];
					} | null;
					readonly id: string;
				} | null;
			})[];
			readonly pageInfo: {
				readonly endCursor: string | null;
				readonly hasNextPage: boolean;
				readonly hasPreviousPage: boolean;
				readonly startCursor: string | null;
			};
		};
		readonly id: string;
	};
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
        "paginated": true,
        "direction": "both",
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
                                        "updates": ["append"],
                                        "nullable": true,
                                        "visible": true,
                                    },

                                    "hasNextPage": {
                                        "type": "Boolean",
                                        "keyRaw": "hasNextPage",
                                        "updates": ["append"],
                                        "visible": true,
                                    },

                                    "hasPreviousPage": {
                                        "type": "Boolean",
                                        "keyRaw": "hasPreviousPage",
                                        "updates": ["prepend"],
                                        "visible": true,
                                    },

                                    "startCursor": {
                                        "type": "String",
                                        "keyRaw": "startCursor",
                                        "updates": ["prepend"],
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
        "paginated": true,
        "direction": "both",
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
                "keyRaw": "entitiesByCursor::paginated",

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
                            "updates": ["append", "prepend"],

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
                                        "updates": ["append"],
                                        "nullable": true,
                                        "visible": true,
                                    },

                                    "hasNextPage": {
                                        "type": "Boolean",
                                        "keyRaw": "hasNextPage",
                                        "updates": ["append"],
                                        "visible": true,
                                    },

                                    "hasPreviousPage": {
                                        "type": "Boolean",
                                        "keyRaw": "hasPreviousPage",
                                        "updates": ["prepend"],
                                        "visible": true,
                                    },

                                    "startCursor": {
                                        "type": "String",
                                        "keyRaw": "startCursor",
                                        "updates": ["prepend"],
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
		readonly " $fragments"?: {};
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

export type TestQuery$unmasked = {
	readonly entitiesByCursor: {
		readonly __typename: "EntityConnection";
		readonly edges: ({
			readonly __typename: "EntityEdge";
			readonly cursor: string;
			readonly node: {} & (({
		readonly firstName: string;
		readonly id: string;
		readonly __typename: "User";
	}) | ({
		readonly " $fragments"?: {};
		readonly __typename: "non-exhaustive; don't match this";
	})) | null;
		})[];
		readonly pageInfo: {
			readonly endCursor: string | null;
			readonly hasNextPage: boolean;
			readonly hasPreviousPage: boolean;
			readonly startCursor: string | null;
		};
	};
};

export type TestQuery$artifact = typeof artifact

"HoudiniHash=0d0fa55060035d4eb6ae7de938bdcfe8703aecff0becc0a479b6e29ffa999e4b"`),
				},
			},
			{
				Name: "paginate on nested field with argument-bearing parent has correct path",
				Input: []string{
					`
					query Info($id: Int = 1) {
						species(id: $id) {
							id
							moves(first: 1) @paginate(mode: SinglePage) {
								edges {
									node { id }
								}
								pageInfo {
									hasNextPage
									hasPreviousPage
								}
							}
						}
					}
					`,
				},
				Pass: true,
				Extra: map[string]any{
					"Info": tests.Dedent(`const artifact = {
    "name": "Info",
    "kind": "HoudiniQuery",
    "hash": "8c477355428da3ad46b8438259e16cda72a336392b61e06b7130fa99bf103631",

    "refetch": {
        "path": ["species","moves"],
        "method": "cursor",
        "pageSize": 1,
        "embedded": false,
        "targetType": "Query",
        "paginated": true,
        "direction": "forward",
        "mode": "SinglePage"
    },

    "raw": ` + "`" + `query Info($after: String, $first: Int = 1, $id: Int = 1) {
    species(id: $id) {
        id
        moves(after: $after, first: $first) {
            edges {
                node {
                    id
                    __typename
                }
                __typename
                cursor
            }
            pageInfo {
                hasNextPage
                hasPreviousPage
                __typename
                startCursor
                endCursor
            }
            __typename
        }
        __typename
    }
}
` + "`" + `,

    "rootType": "Query",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "species": {
                "type": "Species",
                "keyRaw": "species(id: $id)",
                "nullable": true,

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "id": {
                            "type": "Int",
                            "keyRaw": "id",
                            "visible": true,
                        },

                        "moves": {
                            "type": "SpeciesMoveConnection",
                            "keyRaw": "moves(first: $first, after: $after, last: null, before: null)",

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
                                        "type": "SpeciesMoveEdge",
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
                                                    "type": "SpeciesMove",
                                                    "keyRaw": "node",
                                                    "nullable": true,

                                                    "selection": {
                                                        "fields": {
                                                            "__typename": {
                                                                "type": "String",
                                                                "keyRaw": "__typename",
                                                            },

                                                            "id": {
                                                                "type": "Int",
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
            "after": "String",
            "first": "Int",
            "id": "Int",
        },

        "types": {},

        "defaults": {
            "first": 1,
            "id": 1,
        },

        "runtimeScalars": {},
    },

    "policy": "CacheOrNetwork",
    "partial": false
} as const

export default artifact

export type Info = {
	readonly "input": Info$input;
	readonly "result": Info$result | undefined;
};

export type Info$result = {
	readonly species: {
		readonly id: number;
		readonly moves: {
			readonly edges: ({
				readonly node: {
					readonly id: number;
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
	} | null;
};

export type Info$input = {
	after?: string | null;
	first?: number | null;
	id?: number | null;
};

export type Info$unmasked = {
	readonly species: {
		readonly __typename: "Species";
		readonly id: number;
		readonly moves: {
			readonly __typename: "SpeciesMoveConnection";
			readonly edges: ({
				readonly __typename: "SpeciesMoveEdge";
				readonly cursor: string;
				readonly node: {
					readonly __typename: "SpeciesMove";
					readonly id: number;
				} | null;
			})[];
			readonly pageInfo: {
				readonly __typename: "PageInfo";
				readonly endCursor: string | null;
				readonly hasNextPage: boolean;
				readonly hasPreviousPage: boolean;
				readonly startCursor: string | null;
			};
		};
	} | null;
};

export type Info$artifact = typeof artifact

"HoudiniHash=8c477355428da3ad46b8438259e16cda72a336392b61e06b7130fa99bf103631"`),
				},
			},
		},
	})
}
