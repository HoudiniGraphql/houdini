package artifacts_test

import (
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins/tests"
)

func TestRequiredDirective(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig]{
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
					"TestQuery": tests.Dedent(`
              export default {
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
                  "stripVariables": [],

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
                                          "Ghost": {
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
                                              "legends": {
                                                  "type": "Legend",
                                                  "keyRaw": "legends",

                                                  "directives": [{
                                                      "name": "required",
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
                                                          },

                                                          "name": {
                                                              "type": "String",
                                                              "keyRaw": "name",

                                                              "directives": [{
                                                                  "name": "required",
                                                                  "arguments": {}
                                                              }],

                                                              "required": true,
                                                          },
                                                      },
                                                  },

                                                  "abstract": true,
                                                  "required": true,
                                              },
                                              "name": {
                                                  "type": "String",
                                                  "keyRaw": "name",

                                                  "directives": [{
                                                      "name": "required",
                                                      "arguments": {}
                                                  }],

                                                  "required": true,
                                              },
                                          },
                                          "Legend": {
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
                                                      "name": "required",
                                                      "arguments": {}
                                                  }],

                                                  "required": true,
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
              }

              "HoudiniHash=49d37523ee0a68c5e0ab528c947fb122c6a50e5efc79555d84155747aad3b518"
          `),
				},
			},
		},
	})
}
