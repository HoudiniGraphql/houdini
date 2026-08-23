package artifacts_test

import (
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins/tests"
)

func TestAbstractTypeMapExcludesOwnFragments(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniCore]{
		Schema: `
      interface ContentItem {
        id: ID!
        title: String!
      }

      type Article implements ContentItem {
        id: ID!
        title: String!
        author: String!
        wordCount: Int!
      }

      type Video implements ContentItem {
        id: ID!
        title: String!
        durationSeconds: Int!
      }

      type Podcast implements ContentItem {
        id: ID!
        title: String!
      }

      union SearchResult = Article | Video | Podcast

      type Query {
        search: [SearchResult!]!
      }
    `,
		PerformTest: performArtifactTest,
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "union members with own inline fragment must not be in typeMap",
				Pass: true,
				Input: []string{
					`
            query Search {
              search {
                __typename
                ... on ContentItem {
                  id
                  title
                }
                ... on Article {
                  author
                  wordCount
                }
                ... on Video {
                  durationSeconds
                }
              }
            }
          `,
				},
				Extra: map[string]any{
					"Search": "const artifact = {\n    \"name\": \"Search\",\n    \"kind\": \"HoudiniQuery\",\n    \"hash\": \"7f8c1bbc2ab9c254d0cb1eca9818b24992857128f833667c3edac5c664da5911\",\n    \"raw\": `query Search {\n    search {\n        __typename\n        ... on ContentItem {\n            id\n            title\n            __typename\n        }\n        ... on Article {\n            author\n            wordCount\n            __typename\n            id\n        }\n        ... on Video {\n            durationSeconds\n            __typename\n            id\n        }\n    }\n}\n`,\n\n    \"rootType\": \"Query\",\n    \"stripVariables\": [] as Array<string>,\n\n    \"selection\": {\n        \"fields\": {\n            \"search\": {\n                \"type\": \"SearchResult\",\n                \"keyRaw\": \"search\",\n\n                \"selection\": {\n                    \"fields\": {\n                        \"__typename\": {\n                            \"type\": \"String\",\n                            \"keyRaw\": \"__typename\",\n                            \"visible\": true,\n                        },\n                    },\n                    \"abstractFields\": {\n                        \"fields\": {\n                            \"Article\": {\n                                \"__typename\": {\n                                    \"type\": \"String\",\n                                    \"keyRaw\": \"__typename\",\n                                    \"visible\": true,\n                                },\n                                \"author\": {\n                                    \"type\": \"String\",\n                                    \"keyRaw\": \"author\",\n                                    \"visible\": true,\n                                },\n                                \"id\": {\n                                    \"type\": \"ID\",\n                                    \"keyRaw\": \"id\",\n                                    \"visible\": true,\n                                },\n                                \"title\": {\n                                    \"type\": \"String\",\n                                    \"keyRaw\": \"title\",\n                                    \"visible\": true,\n                                },\n                                \"wordCount\": {\n                                    \"type\": \"Int\",\n                                    \"keyRaw\": \"wordCount\",\n                                    \"visible\": true,\n                                },\n                            },\n                            \"ContentItem\": {\n                                \"__typename\": {\n                                    \"type\": \"String\",\n                                    \"keyRaw\": \"__typename\",\n                                    \"visible\": true,\n                                },\n                                \"id\": {\n                                    \"type\": \"ID\",\n                                    \"keyRaw\": \"id\",\n                                    \"visible\": true,\n                                },\n                                \"title\": {\n                                    \"type\": \"String\",\n                                    \"keyRaw\": \"title\",\n                                    \"visible\": true,\n                                },\n                            },\n                            \"Video\": {\n                                \"__typename\": {\n                                    \"type\": \"String\",\n                                    \"keyRaw\": \"__typename\",\n                                    \"visible\": true,\n                                },\n                                \"durationSeconds\": {\n                                    \"type\": \"Int\",\n                                    \"keyRaw\": \"durationSeconds\",\n                                    \"visible\": true,\n                                },\n                                \"id\": {\n                                    \"type\": \"ID\",\n                                    \"keyRaw\": \"id\",\n                                    \"visible\": true,\n                                },\n                                \"title\": {\n                                    \"type\": \"String\",\n                                    \"keyRaw\": \"title\",\n                                    \"visible\": true,\n                                },\n                            },\n                        },\n\n                        \"typeMap\": {\n                            \"Podcast\": \"ContentItem\",\n                        },\n                    },\n                },\n\n                \"abstract\": true,\n                \"visible\": true,\n            },\n        },\n    },\n\n    \"pluginData\": {},\n    \"policy\": \"CacheOrNetwork\",\n    \"partial\": false\n} as const\n\nexport default artifact\n\nexport type Search = {\n\treadonly \"input\"?: Search$input;\n\treadonly \"result\": Search$result | undefined;\n};\n\nexport type Search$result = {\n\treadonly search: ({} & (({\n\t\treadonly id: string;\n\t\treadonly title: string;\n\t\treadonly author: string;\n\t\treadonly wordCount: number;\n\t\treadonly __typename: \"Article\";\n\t}) | ({\n\t\treadonly id: string;\n\t\treadonly title: string;\n\t\treadonly __typename: \"Podcast\";\n\t}) | ({\n\t\treadonly id: string;\n\t\treadonly title: string;\n\t\treadonly durationSeconds: number;\n\t\treadonly __typename: \"Video\";\n\t})))[];\n};\n\nexport type Search$input = null | undefined;\n\nexport type Search$unmasked = {\n\treadonly search: ({} & (({\n\t\treadonly author: string;\n\t\treadonly id: string;\n\t\treadonly title: string;\n\t\treadonly wordCount: number;\n\t\treadonly __typename: \"Article\";\n\t}) | ({\n\t\treadonly id: string;\n\t\treadonly title: string;\n\t\treadonly __typename: \"Podcast\";\n\t}) | ({\n\t\treadonly durationSeconds: number;\n\t\treadonly id: string;\n\t\treadonly title: string;\n\t\treadonly __typename: \"Video\";\n\t})))[];\n};\n\nexport type Search$artifact = typeof artifact\n\n\"HoudiniHash=7f8c1bbc2ab9c254d0cb1eca9818b24992857128f833667c3edac5c664da5911\"",
				},
			},
		},
	})
}
