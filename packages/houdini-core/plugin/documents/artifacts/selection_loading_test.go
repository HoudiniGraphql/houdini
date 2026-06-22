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
			AnimalsList: {};
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
		};
		readonly User: {
			readonly firstName: LoadingType;
		};
	};
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
	};
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
			Info: {};
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
	};
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
					"Query": "import type { LoadingType } from \"houdini/runtime\";\nconst artifact = {\n    \"name\": \"Query\",\n    \"kind\": \"HoudiniQuery\",\n    \"hash\": \"75a077637efd548c3e2b73c0d6ba3a6b0adbf92d3661c3907253b00c250d594a\",\n    \"raw\": `query Query {\n    entities {\n        ... on User {\n            firstName\n            __typename\n            id\n        }\n        ... on Cat {\n            name\n            __typename\n            id\n        }\n        __typename\n    }\n}\n`,\n\n    \"rootType\": \"Query\",\n    \"stripVariables\": [] as Array<string>,\n\n    \"selection\": {\n        \"fields\": {\n            \"entities\": {\n                \"type\": \"Entity\",\n                \"keyRaw\": \"entities\",\n\n                \"selection\": {\n                    \"fields\": {\n                        \"__typename\": {\n                            \"type\": \"String\",\n                            \"keyRaw\": \"__typename\",\n                            \"loading\": {\n                                \"kind\": \"value\",\n                            },\n                        },\n                    },\n                    \"abstractFields\": {\n                        \"fields\": {\n                            \"Cat\": {\n                                \"__typename\": {\n                                    \"type\": \"String\",\n                                    \"keyRaw\": \"__typename\",\n                                    \"loading\": {\n                                        \"kind\": \"value\",\n                                    },\n                                },\n                                \"id\": {\n                                    \"type\": \"ID\",\n                                    \"keyRaw\": \"id\",\n                                    \"loading\": {\n                                        \"kind\": \"value\",\n                                    },\n                                },\n                                \"name\": {\n                                    \"type\": \"String\",\n                                    \"keyRaw\": \"name\",\n                                    \"loading\": {\n                                        \"kind\": \"value\",\n                                    },\n                                    \"visible\": true,\n                                },\n                            },\n                            \"User\": {\n                                \"__typename\": {\n                                    \"type\": \"String\",\n                                    \"keyRaw\": \"__typename\",\n                                    \"loading\": {\n                                        \"kind\": \"value\",\n                                    },\n                                },\n                                \"firstName\": {\n                                    \"type\": \"String\",\n                                    \"keyRaw\": \"firstName\",\n                                    \"loading\": {\n                                        \"kind\": \"value\",\n                                    },\n                                    \"visible\": true,\n                                },\n                                \"id\": {\n                                    \"type\": \"ID\",\n                                    \"keyRaw\": \"id\",\n                                    \"loading\": {\n                                        \"kind\": \"value\",\n                                    },\n                                },\n                            },\n                        },\n\n                        \"typeMap\": {},\n                    },\n\n                    \"loadingTypes\": [\"Cat\", \"User\"],\n                },\n\n                \"loading\": {\n                    \"kind\": \"continue\",\n                    \"list\": {\n                        \"depth\": 1,\n                        \"count\": 3,\n                    },\n                },\n                \"abstract\": true,\n                \"visible\": true,\n            },\n        },\n    },\n\n    \"pluginData\": {},\n    \"enableLoadingState\": \"global\",\n    \"policy\": \"CacheOrNetwork\",\n    \"partial\": false\n} as const\n\nexport default artifact\n\nexport type Query = {\n\treadonly \"input\"?: Query$input;\n\treadonly \"result\": Query$result | undefined;\n};\n\nexport type Query$result = {\n\treadonly entities: ({} & (({\n\t\treadonly name: string;\n\t\treadonly id: string;\n\t\treadonly __typename: \"Cat\";\n\t}) | ({\n\t\treadonly firstName: string;\n\t\treadonly id: string;\n\t\treadonly __typename: \"User\";\n\t}) | ({\n\t\treadonly \" $fragments\"?: {};\n\t\treadonly __typename: \"non-exhaustive; don't match this\";\n\t})))[];\n} | {\n\treadonly entities: ({} & (({\n\t\treadonly name: LoadingType;\n\t\treadonly id: LoadingType;\n\t\treadonly __typename: \"Cat\";\n\t}) | ({\n\t\treadonly firstName: LoadingType;\n\t\treadonly id: LoadingType;\n\t\treadonly __typename: \"User\";\n\t}) | ({\n\t\treadonly \" $fragments\"?: {};\n\t\treadonly __typename: \"non-exhaustive; don't match this\";\n\t})))[];\n};\n\nexport type Query$input = null | undefined;\n\nexport type Query$unmasked = {\n\treadonly entities: ({} & (({\n\t\treadonly id: string;\n\t\treadonly name: string;\n\t\treadonly __typename: \"Cat\";\n\t}) | ({\n\t\treadonly firstName: string;\n\t\treadonly id: string;\n\t\treadonly __typename: \"User\";\n\t}) | ({\n\t\treadonly \" $fragments\"?: {};\n\t\treadonly __typename: \"non-exhaustive; don't match this\";\n\t})))[];\n};\n\nexport type Query$artifact = typeof artifact\n\n\"HoudiniHash=75a077637efd548c3e2b73c0d6ba3a6b0adbf92d3661c3907253b00c250d594a\"",
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
					"Query": "import type { LoadingType } from \"houdini/runtime\";\nconst artifact = {\n    \"name\": \"Query\",\n    \"kind\": \"HoudiniQuery\",\n    \"hash\": \"8a12a21168a8db7431b74a680bdce400f24aa9c577674893fddbf89c6d0a7877\",\n    \"raw\": `query Query {\n    entities {\n        ... on User {\n            firstName\n            __typename\n            id\n        }\n        ... on Cat {\n            name\n            __typename\n            id\n        }\n        __typename\n    }\n    b: entities {\n        ... on User {\n            firstName\n            __typename\n            id\n        }\n        __typename\n    }\n}\n`,\n\n    \"rootType\": \"Query\",\n    \"stripVariables\": [] as Array<string>,\n\n    \"selection\": {\n        \"fields\": {\n            \"b\": {\n                \"type\": \"Entity\",\n                \"keyRaw\": \"b\",\n\n                \"selection\": {\n                    \"fields\": {\n                        \"__typename\": {\n                            \"type\": \"String\",\n                            \"keyRaw\": \"__typename\",\n                        },\n                    },\n                    \"abstractFields\": {\n                        \"fields\": {\n                            \"User\": {\n                                \"__typename\": {\n                                    \"type\": \"String\",\n                                    \"keyRaw\": \"__typename\",\n                                },\n                                \"firstName\": {\n                                    \"type\": \"String\",\n                                    \"keyRaw\": \"firstName\",\n                                    \"visible\": true,\n                                },\n                                \"id\": {\n                                    \"type\": \"ID\",\n                                    \"keyRaw\": \"id\",\n                                },\n                            },\n                        },\n\n                        \"typeMap\": {},\n                    },\n                },\n\n                \"abstract\": true,\n                \"visible\": true,\n            },\n\n            \"entities\": {\n                \"type\": \"Entity\",\n                \"keyRaw\": \"entities\",\n\n                \"directives\": [{\n                    \"name\": \"loading\",\n                    \"arguments\": {\n                        \"cascade\": {\n                            \"kind\": \"BooleanValue\",\n                            \"value\": true\n                        }\n                    }\n                }],\n\n\n                \"selection\": {\n                    \"fields\": {\n                        \"__typename\": {\n                            \"type\": \"String\",\n                            \"keyRaw\": \"__typename\",\n                            \"loading\": {\n                                \"kind\": \"value\",\n                            },\n                        },\n                    },\n                    \"abstractFields\": {\n                        \"fields\": {\n                            \"Cat\": {\n                                \"__typename\": {\n                                    \"type\": \"String\",\n                                    \"keyRaw\": \"__typename\",\n                                    \"loading\": {\n                                        \"kind\": \"value\",\n                                    },\n                                },\n                                \"id\": {\n                                    \"type\": \"ID\",\n                                    \"keyRaw\": \"id\",\n                                    \"loading\": {\n                                        \"kind\": \"value\",\n                                    },\n                                },\n                                \"name\": {\n                                    \"type\": \"String\",\n                                    \"keyRaw\": \"name\",\n                                    \"loading\": {\n                                        \"kind\": \"value\",\n                                    },\n                                    \"visible\": true,\n                                },\n                            },\n                            \"User\": {\n                                \"__typename\": {\n                                    \"type\": \"String\",\n                                    \"keyRaw\": \"__typename\",\n                                    \"loading\": {\n                                        \"kind\": \"value\",\n                                    },\n                                },\n                                \"firstName\": {\n                                    \"type\": \"String\",\n                                    \"keyRaw\": \"firstName\",\n                                    \"loading\": {\n                                        \"kind\": \"value\",\n                                    },\n                                    \"visible\": true,\n                                },\n                                \"id\": {\n                                    \"type\": \"ID\",\n                                    \"keyRaw\": \"id\",\n                                    \"loading\": {\n                                        \"kind\": \"value\",\n                                    },\n                                },\n                            },\n                        },\n\n                        \"typeMap\": {},\n                    },\n\n                    \"loadingTypes\": [\"Cat\", \"User\"],\n                },\n\n                \"loading\": {\n                    \"kind\": \"continue\",\n                    \"list\": {\n                        \"depth\": 1,\n                        \"count\": 3,\n                    },\n                },\n                \"abstract\": true,\n                \"visible\": true,\n            },\n        },\n    },\n\n    \"pluginData\": {},\n    \"enableLoadingState\": \"local\",\n    \"policy\": \"CacheOrNetwork\",\n    \"partial\": false\n} as const\n\nexport default artifact\n\nexport type Query = {\n\treadonly \"input\"?: Query$input;\n\treadonly \"result\": Query$result | undefined;\n};\n\nexport type Query$result = {\n\treadonly entities: ({} & (({\n\t\treadonly name: string;\n\t\treadonly id: string;\n\t\treadonly __typename: \"Cat\";\n\t}) | ({\n\t\treadonly firstName: string;\n\t\treadonly id: string;\n\t\treadonly __typename: \"User\";\n\t}) | ({\n\t\treadonly \" $fragments\"?: {};\n\t\treadonly __typename: \"non-exhaustive; don't match this\";\n\t})))[];\n\treadonly b: ({} & (({\n\t\treadonly firstName: string;\n\t\treadonly id: string;\n\t\treadonly __typename: \"User\";\n\t}) | ({\n\t\treadonly \" $fragments\"?: {};\n\t\treadonly __typename: \"non-exhaustive; don't match this\";\n\t})))[];\n} | {\n\treadonly entities: ({} & (({\n\t\treadonly name: LoadingType;\n\t\treadonly id: LoadingType;\n\t\treadonly __typename: \"Cat\";\n\t}) | ({\n\t\treadonly firstName: LoadingType;\n\t\treadonly id: LoadingType;\n\t\treadonly __typename: \"User\";\n\t}) | ({\n\t\treadonly \" $fragments\"?: {};\n\t\treadonly __typename: \"non-exhaustive; don't match this\";\n\t})))[];\n};\n\nexport type Query$input = null | undefined;\n\nexport type Query$unmasked = {\n\treadonly b: ({} & (({\n\t\treadonly firstName: string;\n\t\treadonly id: string;\n\t\treadonly __typename: \"User\";\n\t}) | ({\n\t\treadonly \" $fragments\"?: {};\n\t\treadonly __typename: \"non-exhaustive; don't match this\";\n\t})))[];\n\treadonly entities: ({} & (({\n\t\treadonly id: string;\n\t\treadonly name: string;\n\t\treadonly __typename: \"Cat\";\n\t}) | ({\n\t\treadonly firstName: string;\n\t\treadonly id: string;\n\t\treadonly __typename: \"User\";\n\t}) | ({\n\t\treadonly \" $fragments\"?: {};\n\t\treadonly __typename: \"non-exhaustive; don't match this\";\n\t})))[];\n};\n\nexport type Query$artifact = typeof artifact\n\n\"HoudiniHash=8a12a21168a8db7431b74a680bdce400f24aa9c577674893fddbf89c6d0a7877\"",
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
					"GlobalLoadingSpreadQuery": "import type { LoadingType } from \"houdini/runtime\";\nconst artifact = {\n    \"name\": \"GlobalLoadingSpreadQuery\",\n    \"kind\": \"HoudiniQuery\",\n    \"hash\": \"f68f32cc631419ea7b0fcbdf8849a91e66be8fbd77af9543cfda312e02438370\",\n    \"raw\": `fragment ConnectionInfo on AnimalConnection {\n    pageInfo {\n        hasNextPage\n        __typename\n    }\n    __typename\n}\n\nquery GlobalLoadingSpreadQuery {\n    monkeys {\n        ...ConnectionInfo\n        __typename\n    }\n}\n`,\n\n    \"rootType\": \"Query\",\n    \"stripVariables\": [] as Array<string>,\n\n    \"selection\": {\n        \"fields\": {\n            \"monkeys\": {\n                \"type\": \"MonkeyConnection\",\n                \"keyRaw\": \"monkeys\",\n\n                \"selection\": {\n                    \"fields\": {\n                        \"__typename\": {\n                            \"type\": \"String\",\n                            \"keyRaw\": \"__typename\",\n                            \"loading\": {\n                                \"kind\": \"value\",\n                            },\n                        },\n\n                        \"pageInfo\": {\n                            \"type\": \"PageInfo\",\n                            \"keyRaw\": \"pageInfo\",\n\n                            \"selection\": {\n                                \"fields\": {\n                                    \"__typename\": {\n                                        \"type\": \"String\",\n                                        \"keyRaw\": \"__typename\",\n                                        \"loading\": {\n                                            \"kind\": \"value\",\n                                        },\n                                    },\n\n                                    \"hasNextPage\": {\n                                        \"type\": \"Boolean\",\n                                        \"keyRaw\": \"hasNextPage\",\n                                        \"loading\": {\n                                            \"kind\": \"value\",\n                                        },\n                                    },\n                                },\n                            },\n\n                            \"loading\": {\n                                \"kind\": \"continue\",\n                            },\n                        },\n                    },\n\n                    \"fragments\": {\n                        \"ConnectionInfo\": {\n                            \"arguments\": {},\n                            \"loading\": true,\n                        },\n                    },\n                },\n\n                \"loading\": {\n                    \"kind\": \"continue\",\n                },\n                \"visible\": true,\n            },\n        },\n    },\n\n    \"pluginData\": {},\n    \"enableLoadingState\": \"global\",\n    \"policy\": \"CacheOrNetwork\",\n    \"partial\": false\n} as const\n\nexport default artifact\n\nexport type GlobalLoadingSpreadQuery = {\n\treadonly \"input\"?: GlobalLoadingSpreadQuery$input;\n\treadonly \"result\": GlobalLoadingSpreadQuery$result | undefined;\n};\n\nexport type GlobalLoadingSpreadQuery$result = {\n\treadonly monkeys: {\n\t\treadonly \" $fragments\": {\n\t\t\tConnectionInfo: {};\n\t\t};\n\t};\n} | {\n\treadonly monkeys: {\n\t\treadonly \" $fragments\": {\n\t\t\tConnectionInfo: {};\n\t\t};\n\t};\n};\n\nexport type GlobalLoadingSpreadQuery$input = null | undefined;\n\nexport type GlobalLoadingSpreadQuery$unmasked = {\n\treadonly monkeys: {\n\t\treadonly __typename: \"MonkeyConnection\";\n\t\treadonly pageInfo: {\n\t\t\treadonly __typename: \"PageInfo\";\n\t\t\treadonly hasNextPage: boolean;\n\t\t};\n\t};\n};\n\nexport type GlobalLoadingSpreadQuery$artifact = typeof artifact\n\n\"HoudiniHash=f68f32cc631419ea7b0fcbdf8849a91e66be8fbd77af9543cfda312e02438370\"",
				},
			},
		},
	})
}
