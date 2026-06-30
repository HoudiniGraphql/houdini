package artifacts_test

import (
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins/tests"
)

// when a fragment spread is tagged with @include or @skip, the fields it inlines
// into the parent selection are conditional: the server might not return them.
// the condition has to be propagated onto those fields in the artifact so the
// runtime doesn't treat a missing non-null value as a reason to cascade null up
// the selection (https://github.com/HoudiniGraphql/houdini/issues/1550)
func TestConditionalFragmentSpread(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniCore]{
		Schema: `
      type Query {
        user(id: ID): User!
        node(id: ID!): Node
      }

      interface Node {
        id: ID!
      }

      type User implements Node {
        id: ID!
        firstName: String!
      }
    `,
		PerformTest: performArtifactTest,
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "include on a spread propagates to inlined fields",
				Pass: true,
				Input: []string{
					`query TestQuery {
            user(id: "1") {
              id
              ...UserDetails @mask_disable @include(if: false)
            }
          }`,
					`fragment UserDetails on User {
            firstName
          }`,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`const artifact = {
    "name": "TestQuery",
    "kind": "HoudiniQuery",
    "hash": "c1028fc6e5213fd703e4e3f2138294735428be9437e68eab4d9854ba91f14c0c",
    "raw": ` + "`" + `query TestQuery {
    user(id: "1") {
        id
        ...UserDetails @include(if: false)
        __typename
    }
}

fragment UserDetails on User {
    firstName
    __typename
    id
}
` + "`" + `,

    "rootType": "Query",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "user": {
                "type": "User",
                "keyRaw": "user(id: \"1\")",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "firstName": {
                            "type": "String",
                            "keyRaw": "firstName",

                            "directives": [{
                                "name": "include",
                                "arguments": {
                                    "if": {
                                        "kind": "BooleanValue",
                                        "value": false
                                    }
                                }
                            }],

                            "visible": true,
                        },

                        "id": {
                            "type": "ID",
                            "keyRaw": "id",
                            "visible": true,
                        },
                    },

                    "fragments": {
                        "UserDetails": {
                            "arguments": {}
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
	readonly user: {
		readonly id: string;
		readonly firstName?: string;
		readonly " $fragments": {
			UserDetails: {};
		};
	};
};

export type TestQuery$input = null | undefined;

export type TestQuery$unmasked = {
	readonly user: {
		readonly __typename: "User";
		readonly firstName: string;
		readonly id: string;
	};
};

export type TestQuery$artifact = typeof artifact

"HoudiniHash=c1028fc6e5213fd703e4e3f2138294735428be9437e68eab4d9854ba91f14c0c"`),
				},
			},
			{
				Name: "skip on a spread propagates through abstract selections",
				Pass: true,
				Input: []string{
					`query TestQuery($show: Boolean!) {
            node(id: "1") {
              id
              ...UserDetails @mask_disable @skip(if: $show)
            }
          }`,
					`fragment UserDetails on User {
            firstName
          }`,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`const artifact = {
    "name": "TestQuery",
    "kind": "HoudiniQuery",
    "hash": "2bc145fc0631e7f8e71fa91c1b77afc0b2aba93ca8fe5f39dc4dbfeceb158063",
    "raw": ` + "`" + `query TestQuery($show: Boolean!) {
    node(id: "1") {
        id
        ...UserDetails @skip(if: $show)
        __typename
    }
}

fragment UserDetails on User {
    firstName
    __typename
    id
}
` + "`" + `,

    "rootType": "Query",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "node": {
                "type": "Node",
                "keyRaw": "node(id: \"1\")",
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
                                        "name": "skip",
                                        "arguments": {
                                            "if": {
                                                "kind": "Variable",
                                                "name": {
                                                    "kind": "Name",
                                                    "value": "show",
                                                }
                                            }
                                        }
                                    }],

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

                    "fragments": {
                        "UserDetails": {
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

    "input": {
        "fields": {
            "show": "Boolean",
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
	readonly node: {
		readonly id: string;
		readonly " $fragments": {
			UserDetails: {};
		};
	} | null;
};

export type TestQuery$input = {
	show: boolean;
};

export type TestQuery$unmasked = {
	readonly node: {} & (({
		readonly firstName: string;
		readonly id: string;
		readonly __typename: "User";
	})) | null;
};

export type TestQuery$artifact = typeof artifact

"HoudiniHash=2bc145fc0631e7f8e71fa91c1b77afc0b2aba93ca8fe5f39dc4dbfeceb158063"`),
				},
			},
			{
				Name: "masked spread with @include does not propagate condition to inlined fields",
				Pass: true,
				Input: []string{
					`query TestQuery($show: Boolean!) {
            user(id: "1") {
              id
              ...UserDetails @include(if: $show)
            }
          }`,
					`fragment UserDetails on User {
            firstName
          }`,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`const artifact = {
    "name": "TestQuery",
    "kind": "HoudiniQuery",
    "hash": "4d664747270e4504bff250185fc0abd5a6778f75b203cbc5e8dca84aa8c36d93",
    "raw": ` + "`" + `query TestQuery($show: Boolean!) {
    user(id: "1") {
        id
        ...UserDetails @include(if: $show)
        __typename
    }
}

fragment UserDetails on User {
    firstName
    __typename
    id
}
` + "`" + `,

    "rootType": "Query",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "user": {
                "type": "User",
                "keyRaw": "user(id: \"1\")",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "firstName": {
                            "type": "String",
                            "keyRaw": "firstName",

                            "directives": [{
                                "name": "include",
                                "arguments": {
                                    "if": {
                                        "kind": "Variable",
                                        "name": {
                                            "kind": "Name",
                                            "value": "show",
                                        }
                                    }
                                }
                            }],

                        },

                        "id": {
                            "type": "ID",
                            "keyRaw": "id",
                            "visible": true,
                        },
                    },

                    "fragments": {
                        "UserDetails": {
                            "arguments": {}
                        },
                    },
                },

                "visible": true,
            },
        },
    },

    "pluginData": {},

    "input": {
        "fields": {
            "show": "Boolean",
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
	readonly user: {
		readonly id: string;
		readonly " $fragments": {
			UserDetails: {};
		};
	};
};

export type TestQuery$input = {
	show: boolean;
};

export type TestQuery$unmasked = {
	readonly user: {
		readonly __typename: "User";
		readonly firstName: string;
		readonly id: string;
	};
};

export type TestQuery$artifact = typeof artifact

"HoudiniHash=4d664747270e4504bff250185fc0abd5a6778f75b203cbc5e8dca84aa8c36d93"`),
				},
			},
		},
	})
}
