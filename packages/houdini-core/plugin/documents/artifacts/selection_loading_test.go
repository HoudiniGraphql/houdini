package artifacts_test

import (
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins/tests"
)

func TestLoadingArtifacts(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniCore]{
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
					"MonkeyListQuery": tests.Dedent(
						`import type { LoadingType } from "houdini/runtime";
const artifact = {
    "name": "MonkeyListQuery",
    "kind": "HoudiniQuery",
    "hash": "ece6ef3e8361e90d01206d34ba36afbeed2fb1903e3946aaa65790ffa7f1d0a2",
    "raw": ` + "`" + `fragment AnimalsList on AnimalConnection {
    edges {
        node {
            id
            name
            __typename
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
    "stripVariables": [] as Array<string>,

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
} as const

export default artifact

export type MonkeyListQuery = {
	readonly "input"?: MonkeyListQuery$input;
	readonly "result": MonkeyListQuery$result | undefined;
};

export type MonkeyListQuery$result = {
	readonly monkeys: {
		readonly pageInfo: {
			readonly hasPreviousPage: boolean;
			readonly hasNextPage: boolean;
			readonly startCursor: string | null;
			readonly endCursor: string | null;
		};
		readonly " $fragments": {
			AnimalsList: {};
		};
	};
} | {
	readonly monkeys: {
		readonly pageInfo: LoadingType;
		readonly " $fragments": {
			AnimalsList: LoadingType;
		};
	};
};

export type MonkeyListQuery$input = null | undefined;

export type MonkeyListQuery$unmasked = {
	readonly monkeys: {
		readonly __typename: "MonkeyConnection";
		readonly edges: ({
			readonly __typename: string;
			readonly node: {
				readonly __typename: string;
				readonly id: string;
				readonly name: string;
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
};

export type MonkeyListQuery$artifact = typeof artifact

"HoudiniHash=ece6ef3e8361e90d01206d34ba36afbeed2fb1903e3946aaa65790ffa7f1d0a2"`,
					),
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
					"Query": tests.Dedent(
						`import type { LoadingType } from "houdini/runtime";
const artifact = {
    "name": "Query",
    "kind": "HoudiniQuery",
    "hash": "a7e16dc3a8fe4cc7a47a16444f1809cbc0865be2d997ae28e4e2e2539e890841",
    "raw": ` + "`" + `query Query {
    catOwners {
        cats {
            id
            __typename
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
    "stripVariables": [] as Array<string>,

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
} as const

export default artifact

export type Query = {
	readonly "input"?: Query$input;
	readonly "result": Query$result | undefined;
};

export type Query$result = {
	readonly catOwners: ({} & (({
		readonly firstName: string;
		readonly id: string;
		readonly __typename: "User";
	}) | ({
		readonly " $fragments"?: {};
		readonly __typename: "non-exhaustive; don't match this";
	})))[];
} | {
	readonly catOwners: {
		readonly cats: {
			readonly id: LoadingType;
		}[];
		readonly User: {
			readonly firstName: LoadingType;
		};
	}[];
};

export type Query$input = null | undefined;

export type Query$unmasked = {
	readonly catOwners: ({} & (({
		readonly cats: ({
			readonly __typename: "Cat";
			readonly id: string;
		})[];
		readonly firstName: string;
		readonly id: string;
		readonly __typename: "User";
	}) | ({
		readonly " $fragments"?: {};
		readonly __typename: "non-exhaustive; don't match this";
	})))[];
};

export type Query$artifact = typeof artifact

"HoudiniHash=a7e16dc3a8fe4cc7a47a16444f1809cbc0865be2d997ae28e4e2e2539e890841"`,
					),
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
					"Query": tests.Dedent(
						`import type { LoadingType } from "houdini/runtime";
const artifact = {
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
    "stripVariables": [] as Array<string>,

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
} as const

export default artifact

export type Query = {
	readonly "input"?: Query$input;
	readonly "result": Query$result | undefined;
};

export type Query$result = {
	readonly entities: ({} & (({
		readonly name: string;
		readonly id: string;
		readonly __typename: "Cat";
	}) | ({
		readonly firstName: string;
		readonly id: string;
		readonly __typename: "User";
	}) | ({
		readonly " $fragments"?: {};
		readonly __typename: "non-exhaustive; don't match this";
	})))[];
} | {
	readonly entities: {
		readonly User: {
			readonly firstName: LoadingType;
		};
		readonly Cat: {
			readonly name: LoadingType;
		};
	}[];
};

export type Query$input = null | undefined;

export type Query$unmasked = {
	readonly entities: ({} & (({
		readonly id: string;
		readonly name: string;
		readonly __typename: "Cat";
	}) | ({
		readonly firstName: string;
		readonly id: string;
		readonly __typename: "User";
	}) | ({
		readonly " $fragments"?: {};
		readonly __typename: "non-exhaustive; don't match this";
	})))[];
};

export type Query$artifact = typeof artifact

"HoudiniHash=75a077637efd548c3e2b73c0d6ba3a6b0adbf92d3661c3907253b00c250d594a"`,
					),
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
					"Query": tests.Dedent(
						`import type { LoadingType } from "houdini/runtime";
const artifact = {
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
    "stripVariables": [] as Array<string>,

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
} as const

export default artifact

export type Query = {
	readonly "input"?: Query$input;
	readonly "result": Query$result | undefined;
};

export type Query$result = {
	readonly entity: {
		readonly " $fragments": {
			Info: {};
		};
	};
} | {
	readonly entity: {
		readonly " $fragments": {
			Info: LoadingType;
		};
	};
};

export type Query$input = null | undefined;

export type Query$unmasked = {
	readonly entity: {} & (({
		readonly firstName: string;
		readonly id: string;
		readonly __typename: "User";
	}) | ({
		readonly " $fragments"?: {};
		readonly __typename: "non-exhaustive; don't match this";
	}));
};

export type Query$artifact = typeof artifact

"HoudiniHash=5ba953f37cfa2e0ce515c4c22ce9c6e3206fc05adc5c96fbc7a3184691d672f1"`,
					),
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
					"Query": tests.Dedent(
						`import type { LoadingType } from "houdini/runtime";
const artifact = {
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
    "stripVariables": [] as Array<string>,

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
                            "value": "5"
                        }
                    }
                }],


                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
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
} as const

export default artifact

export type Query = {
	readonly "input"?: Query$input;
	readonly "result": Query$result | undefined;
};

export type Query$result = {
	readonly entities: ({} & (({
		readonly name: string;
		readonly id: string;
		readonly __typename: "Cat";
	}) | ({
		readonly firstName: string;
		readonly id: string;
		readonly __typename: "User";
	}) | ({
		readonly " $fragments"?: {};
		readonly __typename: "non-exhaustive; don't match this";
	})))[];
} | {
	readonly entities: {
		readonly User: {
			readonly firstName: LoadingType;
		};
	}[];
};

export type Query$input = null | undefined;

export type Query$unmasked = {
	readonly entities: ({} & (({
		readonly id: string;
		readonly name: string;
		readonly __typename: "Cat";
	}) | ({
		readonly firstName: string;
		readonly id: string;
		readonly __typename: "User";
	}) | ({
		readonly " $fragments"?: {};
		readonly __typename: "non-exhaustive; don't match this";
	})))[];
};

export type Query$artifact = typeof artifact

"HoudiniHash=75a077637efd548c3e2b73c0d6ba3a6b0adbf92d3661c3907253b00c250d594a"`,
					),
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
					"Query": tests.Dedent(
						`import type { LoadingType } from "houdini/runtime";
const artifact = {
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
    "stripVariables": [] as Array<string>,

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
                                },
                                "id": {
                                    "type": "ID",
                                    "keyRaw": "id",
                                    "loading": {
                                        "kind": "value",
                                    },
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
    "enableLoadingState": "global",
    "policy": "CacheOrNetwork",
    "partial": false
} as const

export default artifact

export type Query = {
	readonly "input"?: Query$input;
	readonly "result": Query$result | undefined;
};

export type Query$result = {
	readonly entities: ({} & (({
		readonly name: string;
		readonly id: string;
		readonly __typename: "Cat";
	}) | ({
		readonly firstName: string;
		readonly id: string;
		readonly __typename: "User";
	}) | ({
		readonly " $fragments"?: {};
		readonly __typename: "non-exhaustive; don't match this";
	})))[];
} | {
	readonly entities: ({} & (({
		readonly name: LoadingType;
		readonly id: LoadingType;
		readonly __typename: "Cat";
	}) | ({
		readonly firstName: LoadingType;
		readonly id: LoadingType;
		readonly __typename: "User";
	}) | ({
		readonly " $fragments"?: {};
		readonly __typename: "non-exhaustive; don't match this";
	})))[];
};

export type Query$input = null | undefined;

export type Query$unmasked = {
	readonly entities: ({} & (({
		readonly id: string;
		readonly name: string;
		readonly __typename: "Cat";
	}) | ({
		readonly firstName: string;
		readonly id: string;
		readonly __typename: "User";
	}) | ({
		readonly " $fragments"?: {};
		readonly __typename: "non-exhaustive; don't match this";
	})))[];
};

export type Query$artifact = typeof artifact

"HoudiniHash=75a077637efd548c3e2b73c0d6ba3a6b0adbf92d3661c3907253b00c250d594a"`,
					),
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
					"Query": tests.Dedent(
						`import type { LoadingType } from "houdini/runtime";
const artifact = {
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
    "stripVariables": [] as Array<string>,

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
                                },
                                "id": {
                                    "type": "ID",
                                    "keyRaw": "id",
                                    "loading": {
                                        "kind": "value",
                                    },
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
} as const

export default artifact

export type Query = {
	readonly "input"?: Query$input;
	readonly "result": Query$result | undefined;
};

export type Query$result = {
	readonly entities: ({} & (({
		readonly name: string;
		readonly id: string;
		readonly __typename: "Cat";
	}) | ({
		readonly firstName: string;
		readonly id: string;
		readonly __typename: "User";
	}) | ({
		readonly " $fragments"?: {};
		readonly __typename: "non-exhaustive; don't match this";
	})))[];
	readonly b: ({} & (({
		readonly firstName: string;
		readonly id: string;
		readonly __typename: "User";
	}) | ({
		readonly " $fragments"?: {};
		readonly __typename: "non-exhaustive; don't match this";
	})))[];
} | {
	readonly entities: ({} & (({
		readonly name: LoadingType;
		readonly id: LoadingType;
		readonly __typename: "Cat";
	}) | ({
		readonly firstName: LoadingType;
		readonly id: LoadingType;
		readonly __typename: "User";
	}) | ({
		readonly " $fragments"?: {};
		readonly __typename: "non-exhaustive; don't match this";
	})))[];
};

export type Query$input = null | undefined;

export type Query$unmasked = {
	readonly b: ({} & (({
		readonly firstName: string;
		readonly id: string;
		readonly __typename: "User";
	}) | ({
		readonly " $fragments"?: {};
		readonly __typename: "non-exhaustive; don't match this";
	})))[];
	readonly entities: ({} & (({
		readonly id: string;
		readonly name: string;
		readonly __typename: "Cat";
	}) | ({
		readonly firstName: string;
		readonly id: string;
		readonly __typename: "User";
	}) | ({
		readonly " $fragments"?: {};
		readonly __typename: "non-exhaustive; don't match this";
	})))[];
};

export type Query$artifact = typeof artifact

"HoudiniHash=8a12a21168a8db7431b74a680bdce400f24aa9c577674893fddbf89c6d0a7877"`,
					),
				},
			},
			{
				// a document-level @loading must cascade onto fragment spreads, not just
				// fields. without this the spread is omitted from the loading-state
				// selection (no "loading": true), so the runtime can't bind it during the
				// loading frame.
				Name: "global @loading cascades to fragment spreads",
				Pass: true,
				Input: []string{
					`
            query GlobalLoadingSpreadQuery @loading {
              monkeys {
                ...ConnectionInfo
              }
            }
          `,
					`
            fragment ConnectionInfo on AnimalConnection {
              pageInfo {
                hasNextPage
              }
            }
          `,
				},
				Extra: map[string]any{
					"GlobalLoadingSpreadQuery": tests.Dedent(
						`import type { LoadingType } from "houdini/runtime";
const artifact = {
    "name": "GlobalLoadingSpreadQuery",
    "kind": "HoudiniQuery",
    "hash": "f68f32cc631419ea7b0fcbdf8849a91e66be8fbd77af9543cfda312e02438370",
    "raw": ` + "`" + `fragment ConnectionInfo on AnimalConnection {
    pageInfo {
        hasNextPage
        __typename
    }
    __typename
}

query GlobalLoadingSpreadQuery {
    monkeys {
        ...ConnectionInfo
        __typename
    }
}
` + "`" + `,

    "rootType": "Query",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "monkeys": {
                "type": "MonkeyConnection",
                "keyRaw": "monkeys",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                            "loading": {
                                "kind": "value",
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
                                        "loading": {
                                            "kind": "value",
                                        },
                                    },

                                    "hasNextPage": {
                                        "type": "Boolean",
                                        "keyRaw": "hasNextPage",
                                        "loading": {
                                            "kind": "value",
                                        },
                                    },
                                },
                            },

                            "loading": {
                                "kind": "continue",
                            },
                        },
                    },

                    "fragments": {
                        "ConnectionInfo": {
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
    "enableLoadingState": "global",
    "policy": "CacheOrNetwork",
    "partial": false
} as const

export default artifact

export type GlobalLoadingSpreadQuery = {
	readonly "input"?: GlobalLoadingSpreadQuery$input;
	readonly "result": GlobalLoadingSpreadQuery$result | undefined;
};

export type GlobalLoadingSpreadQuery$result = {
	readonly monkeys: {
		readonly " $fragments": {
			ConnectionInfo: {};
		};
	};
} | {
	readonly monkeys: {
		readonly " $fragments": {
			ConnectionInfo: LoadingType;
		};
	};
};

export type GlobalLoadingSpreadQuery$input = null | undefined;

export type GlobalLoadingSpreadQuery$unmasked = {
	readonly monkeys: {
		readonly __typename: "MonkeyConnection";
		readonly pageInfo: {
			readonly __typename: "PageInfo";
			readonly hasNextPage: boolean;
		};
	};
};

export type GlobalLoadingSpreadQuery$artifact = typeof artifact

"HoudiniHash=f68f32cc631419ea7b0fcbdf8849a91e66be8fbd77af9543cfda312e02438370"`,
					),
				},
			},
			{
				Name: "document-level @loading composes with field-level @loading(count) on a list",
				Pass: true,
				Input: []string{
					`query GlobalListConfig @loading {
            monkeys {
              pageInfo {
                hasNextPage
              }
              edges @loading(count: 2) {
                node {
                  id
                }
              }
            }
          }`,
				},
				Extra: map[string]any{
					"GlobalListConfig": "import type { LoadingType } from \"houdini/runtime\";\nconst artifact = {\n    \"name\": \"GlobalListConfig\",\n    \"kind\": \"HoudiniQuery\",\n    \"hash\": \"bf928586ecef8632f1df8ce14f2ec7d9012348852c086f026c174035128d92ba\",\n    \"raw\": `query GlobalListConfig {\n    monkeys {\n        pageInfo {\n            hasNextPage\n            __typename\n        }\n        edges {\n            node {\n                id\n                __typename\n            }\n            __typename\n        }\n        __typename\n    }\n}\n`,\n\n    \"rootType\": \"Query\",\n    \"stripVariables\": [] as Array<string>,\n\n    \"selection\": {\n        \"fields\": {\n            \"monkeys\": {\n                \"type\": \"MonkeyConnection\",\n                \"keyRaw\": \"monkeys\",\n\n                \"selection\": {\n                    \"fields\": {\n                        \"__typename\": {\n                            \"type\": \"String\",\n                            \"keyRaw\": \"__typename\",\n                            \"loading\": {\n                                \"kind\": \"value\",\n                            },\n                        },\n\n                        \"edges\": {\n                            \"type\": \"MonkeyEdge\",\n                            \"keyRaw\": \"edges\",\n\n                            \"directives\": [{\n                                \"name\": \"loading\",\n                                \"arguments\": {\n                                    \"count\": {\n                                        \"kind\": \"IntValue\",\n                                        \"value\": \"2\"\n                                    }\n                                }\n                            }],\n\n\n                            \"selection\": {\n                                \"fields\": {\n                                    \"__typename\": {\n                                        \"type\": \"String\",\n                                        \"keyRaw\": \"__typename\",\n                                        \"loading\": {\n                                            \"kind\": \"value\",\n                                        },\n                                    },\n\n                                    \"node\": {\n                                        \"type\": \"Monkey\",\n                                        \"keyRaw\": \"node\",\n                                        \"nullable\": true,\n\n                                        \"selection\": {\n                                            \"fields\": {\n                                                \"__typename\": {\n                                                    \"type\": \"String\",\n                                                    \"keyRaw\": \"__typename\",\n                                                    \"loading\": {\n                                                        \"kind\": \"value\",\n                                                    },\n                                                },\n\n                                                \"id\": {\n                                                    \"type\": \"ID\",\n                                                    \"keyRaw\": \"id\",\n                                                    \"loading\": {\n                                                        \"kind\": \"value\",\n                                                    },\n                                                    \"visible\": true,\n                                                },\n                                            },\n                                        },\n\n                                        \"loading\": {\n                                            \"kind\": \"continue\",\n                                        },\n                                        \"visible\": true,\n                                    },\n                                },\n                            },\n\n                            \"loading\": {\n                                \"kind\": \"continue\",\n                                \"list\": {\n                                    \"depth\": 1,\n                                    \"count\": 2,\n                                },\n                            },\n                            \"visible\": true,\n                        },\n\n                        \"pageInfo\": {\n                            \"type\": \"PageInfo\",\n                            \"keyRaw\": \"pageInfo\",\n\n                            \"selection\": {\n                                \"fields\": {\n                                    \"__typename\": {\n                                        \"type\": \"String\",\n                                        \"keyRaw\": \"__typename\",\n                                        \"loading\": {\n                                            \"kind\": \"value\",\n                                        },\n                                    },\n\n                                    \"hasNextPage\": {\n                                        \"type\": \"Boolean\",\n                                        \"keyRaw\": \"hasNextPage\",\n                                        \"loading\": {\n                                            \"kind\": \"value\",\n                                        },\n                                        \"visible\": true,\n                                    },\n                                },\n                            },\n\n                            \"loading\": {\n                                \"kind\": \"continue\",\n                            },\n                            \"visible\": true,\n                        },\n                    },\n                },\n\n                \"loading\": {\n                    \"kind\": \"continue\",\n                },\n                \"visible\": true,\n            },\n        },\n    },\n\n    \"pluginData\": {},\n    \"enableLoadingState\": \"local\",\n    \"policy\": \"CacheOrNetwork\",\n    \"partial\": false\n} as const\n\nexport default artifact\n\nexport type GlobalListConfig = {\n\treadonly \"input\"?: GlobalListConfig$input;\n\treadonly \"result\": GlobalListConfig$result | undefined;\n};\n\nexport type GlobalListConfig$result = {\n\treadonly monkeys: {\n\t\treadonly pageInfo: {\n\t\t\treadonly hasNextPage: boolean;\n\t\t};\n\t\treadonly edges: ({\n\t\t\treadonly node: {\n\t\t\t\treadonly id: string;\n\t\t\t} | null;\n\t\t})[];\n\t};\n} | {\n\treadonly monkeys: {\n\t\treadonly pageInfo: {\n\t\t\treadonly hasNextPage: LoadingType;\n\t\t};\n\t\treadonly edges: {\n\t\t\treadonly node: {\n\t\t\t\treadonly id: LoadingType;\n\t\t\t};\n\t\t}[];\n\t};\n};\n\nexport type GlobalListConfig$input = null | undefined;\n\nexport type GlobalListConfig$unmasked = {\n\treadonly monkeys: {\n\t\treadonly __typename: \"MonkeyConnection\";\n\t\treadonly edges: ({\n\t\t\treadonly __typename: \"MonkeyEdge\";\n\t\t\treadonly node: {\n\t\t\t\treadonly __typename: \"Monkey\";\n\t\t\t\treadonly id: string;\n\t\t\t} | null;\n\t\t})[];\n\t\treadonly pageInfo: {\n\t\t\treadonly __typename: \"PageInfo\";\n\t\t\treadonly hasNextPage: boolean;\n\t\t};\n\t};\n};\n\nexport type GlobalListConfig$artifact = typeof artifact\n\n\"HoudiniHash=bf928586ecef8632f1df8ce14f2ec7d9012348852c086f026c174035128d92ba\"",
				},
			},
			{
				Name: "definition-level @loading on a fragment generates a loading variant",
				Pass: true,
				Input: []string{
					`query CascadeFragmentLoadingQuery {
            entity {
              ... on Cat {
                ...CascadeFragmentLoading
              }
            }
          }`,
					`fragment CascadeFragmentLoading on Cat @loading {
            name
          }`,
				},
				Extra: map[string]any{
					"CascadeFragmentLoading": "import type { LoadingType } from \"houdini/runtime\";\nconst artifact = {\n    \"name\": \"CascadeFragmentLoading\",\n    \"kind\": \"HoudiniFragment\",\n    \"hash\": \"ae47388a479222f23e79d8bac545d2111a5698c2fcae08e6c8028813d56ec112\",\n    \"raw\": `fragment CascadeFragmentLoading on Cat {\n    name\n    __typename\n    id\n}\n`,\n\n    \"rootType\": \"Cat\",\n    \"stripVariables\": [] as Array<string>,\n\n    \"selection\": {\n        \"fields\": {\n            \"__typename\": {\n                \"type\": \"String\",\n                \"keyRaw\": \"__typename\",\n                \"loading\": {\n                    \"kind\": \"value\",\n                },\n                \"visible\": true,\n            },\n\n            \"id\": {\n                \"type\": \"ID\",\n                \"keyRaw\": \"id\",\n                \"loading\": {\n                    \"kind\": \"value\",\n                },\n                \"visible\": true,\n            },\n\n            \"name\": {\n                \"type\": \"String\",\n                \"keyRaw\": \"name\",\n                \"loading\": {\n                    \"kind\": \"value\",\n                },\n                \"visible\": true,\n            },\n        },\n    },\n\n    \"pluginData\": {},\n    \"enableLoadingState\": \"global\",\n} as const\n\nexport default artifact\n\nexport type CascadeFragmentLoading$input = never;\n\nexport type CascadeFragmentLoading = {\n\treadonly \"shape\"?: CascadeFragmentLoading$data;\n\treadonly \" $fragments\": {\n\t\t\"CascadeFragmentLoading\": { readonly \"expected a CascadeFragmentLoading fragment spread\"?: never } | LoadingType;\n\t};\n};\n\nexport type CascadeFragmentLoading$data = {\n\treadonly name: string;\n} | {\n\treadonly name: LoadingType;\n};\n\nexport type CascadeFragmentLoading$artifact = typeof artifact\n\n\"HoudiniHash=ae47388a479222f23e79d8bac545d2111a5698c2fcae08e6c8028813d56ec112\"",
				},
			},
		},
	})
}
