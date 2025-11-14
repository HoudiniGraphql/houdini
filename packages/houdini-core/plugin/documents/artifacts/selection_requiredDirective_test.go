package artifacts_test

import (
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins/tests"
)

func TestRequiredDirective(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniCore]{
		Schema: `
      type Query { 
        node(id: ID!): Node
      }
      
      interface Node { 
        id: ID!
      }

			type Ghost implements Legend & Node {
        id: ID!
				name: String
        legends: [Legend]
			}

      interface Legend implements Node {
        id: ID!
        name: String
      }

    `,
		PerformTest: performArtifactTest,
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "Client nullability",
				Pass: true,
				Input: []string{
					`
            query TestQuery($id: ID!) {
              node(id: $id) {
                ...LegendWithRequiredName
                ...GhostWithRequiredLegendName
                ...GhostWithRequiredLegendAndLegendName
              }
            }
          `,
					`
            fragment LegendWithRequiredName on Legend {
              name @required
            }
          `,
					`
            fragment GhostWithRequiredLegendName on Ghost {
              legends {
                name @required
              }
            }
          `,
					`
            fragment GhostWithRequiredLegendAndLegendName on Ghost {
              legends @required {
                name @required
              }
            }
          `,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`const artifact = {
    "name": "TestQuery",
    "kind": "HoudiniQuery",
    "hash": "49d37523ee0a68c5e0ab528c947fb122c6a50e5efc79555d84155747aad3b518",
    "raw": ` + "`" + `fragment GhostWithRequiredLegendAndLegendName on Ghost {
    legends {
        name
        __typename
        id
    }
    __typename
    id
}

fragment GhostWithRequiredLegendName on Ghost {
    legends {
        name
        __typename
        id
    }
    __typename
    id
}

fragment LegendWithRequiredName on Legend {
    name
    __typename
    id
}

query TestQuery($id: ID!) {
    node(id: $id) {
        ...LegendWithRequiredName
        ...GhostWithRequiredLegendName
        ...GhostWithRequiredLegendAndLegendName
        __typename
        id
    }
}
` + "`" + `,

    "rootType": "Query",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "node": {
                "type": "Node",
                "keyRaw": "node(id: $id)",
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
                            "Ghost": {
                                "__typename": {
                                    "type": "String",
                                    "keyRaw": "__typename",
                                },
                                "id": {
                                    "type": "ID",
                                    "keyRaw": "id",
                                },
                                "legends": {
                                    "type": "Legend",
                                    "keyRaw": "legends",
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
                                                "nullable": true,
                                                "visible": true,
                                            },
                                        },
                                    },

                                    "abstract": true,
                                    "visible": true,
                                },
                                "name": {
                                    "type": "String",
                                    "keyRaw": "name",
                                    "nullable": true,
                                    "visible": true,
                                },
                            },
                            "Legend": {
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
                                    "nullable": true,
                                    "visible": true,
                                },
                            },
                        },

                        "typeMap": {
                            "Ghost": "Legend",
                        },
                    },

                    "fragments": {
                        "GhostWithRequiredLegendAndLegendName": {
                            "arguments": {}
                        },
                        "GhostWithRequiredLegendName": {
                            "arguments": {}
                        },
                        "LegendWithRequiredName": {
                            "arguments": {}
                        },
                    },
                },

                "abstract": true,
                "abstractHasRequired": true,
                "visible": true,
            },
        },
    },

    "pluginData": {},

    "input": {
        "fields": {
            "id": "ID",
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
		readonly " $fragments": {
			LegendWithRequiredName: {};
			GhostWithRequiredLegendName: {};
			GhostWithRequiredLegendAndLegendName: {};
		};
	} | null;
};

export type TestQuery$input = {
	id: string;
};

export type TestQuery$artifact = typeof artifact

"HoudiniHash=49d37523ee0a68c5e0ab528c947fb122c6a50e5efc79555d84155747aad3b518"`),
				},
			},
		},
	})
}
