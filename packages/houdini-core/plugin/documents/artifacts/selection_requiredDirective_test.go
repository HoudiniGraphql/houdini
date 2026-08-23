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
					"TestQuery": "const artifact = {\n    \"name\": \"TestQuery\",\n    \"kind\": \"HoudiniQuery\",\n    \"hash\": \"49d37523ee0a68c5e0ab528c947fb122c6a50e5efc79555d84155747aad3b518\",\n    \"raw\": `fragment GhostWithRequiredLegendAndLegendName on Ghost {\n    legends {\n        name\n        __typename\n        id\n    }\n    __typename\n    id\n}\n\nfragment GhostWithRequiredLegendName on Ghost {\n    legends {\n        name\n        __typename\n        id\n    }\n    __typename\n    id\n}\n\nfragment LegendWithRequiredName on Legend {\n    name\n    __typename\n    id\n}\n\nquery TestQuery($id: ID!) {\n    node(id: $id) {\n        ...LegendWithRequiredName\n        ...GhostWithRequiredLegendName\n        ...GhostWithRequiredLegendAndLegendName\n        __typename\n        id\n    }\n}\n`,\n\n    \"rootType\": \"Query\",\n    \"stripVariables\": [] as Array<string>,\n\n    \"selection\": {\n        \"fields\": {\n            \"node\": {\n                \"type\": \"Node\",\n                \"keyRaw\": \"node(id: $id)\",\n                \"nullable\": true,\n\n                \"selection\": {\n                    \"fields\": {\n                        \"__typename\": {\n                            \"type\": \"String\",\n                            \"keyRaw\": \"__typename\",\n                        },\n\n                        \"id\": {\n                            \"type\": \"ID\",\n                            \"keyRaw\": \"id\",\n                        },\n                    },\n                    \"abstractFields\": {\n                        \"fields\": {\n                            \"Ghost\": {\n                                \"__typename\": {\n                                    \"type\": \"String\",\n                                    \"keyRaw\": \"__typename\",\n                                },\n                                \"id\": {\n                                    \"type\": \"ID\",\n                                    \"keyRaw\": \"id\",\n                                },\n                                \"legends\": {\n                                    \"type\": \"Legend\",\n                                    \"keyRaw\": \"legends\",\n                                    \"nullable\": true,\n\n                                    \"selection\": {\n                                        \"fields\": {\n                                            \"__typename\": {\n                                                \"type\": \"String\",\n                                                \"keyRaw\": \"__typename\",\n                                            },\n\n                                            \"id\": {\n                                                \"type\": \"ID\",\n                                                \"keyRaw\": \"id\",\n                                            },\n\n                                            \"name\": {\n                                                \"type\": \"String\",\n                                                \"keyRaw\": \"name\",\n                                                \"nullable\": true,\n                                            },\n                                        },\n                                    },\n\n                                    \"abstract\": true,\n                                },\n                                \"name\": {\n                                    \"type\": \"String\",\n                                    \"keyRaw\": \"name\",\n                                    \"nullable\": true,\n                                },\n                            },\n                            \"Legend\": {\n                                \"__typename\": {\n                                    \"type\": \"String\",\n                                    \"keyRaw\": \"__typename\",\n                                },\n                                \"id\": {\n                                    \"type\": \"ID\",\n                                    \"keyRaw\": \"id\",\n                                },\n                                \"name\": {\n                                    \"type\": \"String\",\n                                    \"keyRaw\": \"name\",\n                                    \"nullable\": true,\n                                },\n                            },\n                        },\n\n                        \"typeMap\": {},\n                    },\n\n                    \"fragments\": {\n                        \"GhostWithRequiredLegendAndLegendName\": {\n                            \"arguments\": {}\n                        },\n                        \"GhostWithRequiredLegendName\": {\n                            \"arguments\": {}\n                        },\n                        \"LegendWithRequiredName\": {\n                            \"arguments\": {}\n                        },\n                    },\n                },\n\n                \"abstract\": true,\n                \"abstractHasRequired\": true,\n                \"visible\": true,\n            },\n        },\n    },\n\n    \"pluginData\": {},\n\n    \"input\": {\n        \"fields\": {\n            \"id\": \"ID\",\n        },\n\n        \"types\": {},\n\n        \"defaults\": {},\n\n        \"runtimeScalars\": {},\n    },\n\n    \"policy\": \"CacheOrNetwork\",\n    \"partial\": false\n} as const\n\nexport default artifact\n\nexport type TestQuery = {\n\treadonly \"input\": TestQuery$input;\n\treadonly \"result\": TestQuery$result | undefined;\n};\n\nexport type TestQuery$result = {\n\treadonly node: {\n\t\treadonly \" $fragments\": {\n\t\t\tLegendWithRequiredName: {};\n\t\t\tGhostWithRequiredLegendName: {};\n\t\t\tGhostWithRequiredLegendAndLegendName: {};\n\t\t};\n\t} | null;\n};\n\nexport type TestQuery$input = {\n\tid: string;\n};\n\nexport type TestQuery$unmasked = {\n\treadonly node: {} & (({\n\t\treadonly id: string;\n\t\treadonly legends: ({\n\t\t\treadonly __typename: string;\n\t\t\treadonly id: string;\n\t\t\treadonly name: string | null;\n\t\t} | null)[] | null;\n\t\treadonly name: string | null;\n\t\treadonly __typename: \"Ghost\";\n\t}) | ({\n\t\treadonly \" $fragments\"?: {};\n\t\treadonly __typename: \"non-exhaustive; don't match this\";\n\t})) | null;\n};\n\nexport type TestQuery$artifact = typeof artifact\n\n\"HoudiniHash=49d37523ee0a68c5e0ab528c947fb122c6a50e5efc79555d84155747aad3b518\"",
				},
			},
		},
	})
}
