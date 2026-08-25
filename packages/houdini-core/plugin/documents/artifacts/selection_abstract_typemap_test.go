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
					"Search": tests.Dedent(`const artifact = {
    "name": "Search",
    "kind": "HoudiniQuery",
    "hash": "7f8c1bbc2ab9c254d0cb1eca9818b24992857128f833667c3edac5c664da5911",
    "raw": ` + "`" + `query Search {
    search {
        __typename
        ... on ContentItem {
            id
            title
            __typename
        }
        ... on Article {
            author
            wordCount
            __typename
            id
        }
        ... on Video {
            durationSeconds
            __typename
            id
        }
    }
}
` + "`" + `,

    "rootType": "Query",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "search": {
                "type": "SearchResult",
                "keyRaw": "search",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                            "visible": true,
                        },
                    },
                    "abstractFields": {
                        "fields": {
                            "Article": {
                                "__typename": {
                                    "type": "String",
                                    "keyRaw": "__typename",
                                    "visible": true,
                                },
                                "author": {
                                    "type": "String",
                                    "keyRaw": "author",
                                    "visible": true,
                                },
                                "id": {
                                    "type": "ID",
                                    "keyRaw": "id",
                                    "visible": true,
                                },
                                "title": {
                                    "type": "String",
                                    "keyRaw": "title",
                                    "visible": true,
                                },
                                "wordCount": {
                                    "type": "Int",
                                    "keyRaw": "wordCount",
                                    "visible": true,
                                },
                            },
                            "ContentItem": {
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
                                "title": {
                                    "type": "String",
                                    "keyRaw": "title",
                                    "visible": true,
                                },
                            },
                            "Video": {
                                "__typename": {
                                    "type": "String",
                                    "keyRaw": "__typename",
                                    "visible": true,
                                },
                                "durationSeconds": {
                                    "type": "Int",
                                    "keyRaw": "durationSeconds",
                                    "visible": true,
                                },
                                "id": {
                                    "type": "ID",
                                    "keyRaw": "id",
                                    "visible": true,
                                },
                                "title": {
                                    "type": "String",
                                    "keyRaw": "title",
                                    "visible": true,
                                },
                            },
                        },

                        "typeMap": {
                            "Podcast": "ContentItem",
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

export type Search = {
	readonly "input"?: Search$input;
	readonly "result": Search$result | undefined;
};

export type Search$result = {
	readonly search: ({} & (({
		readonly id: string;
		readonly title: string;
		readonly author: string;
		readonly wordCount: number;
		readonly __typename: "Article";
	}) | ({
		readonly id: string;
		readonly title: string;
		readonly __typename: "Podcast";
	}) | ({
		readonly id: string;
		readonly title: string;
		readonly durationSeconds: number;
		readonly __typename: "Video";
	})))[];
};

export type Search$input = null | undefined;

export type Search$unmasked = {
	readonly search: ({} & (({
		readonly author: string;
		readonly id: string;
		readonly title: string;
		readonly wordCount: number;
		readonly __typename: "Article";
	}) | ({
		readonly id: string;
		readonly title: string;
		readonly __typename: "Podcast";
	}) | ({
		readonly durationSeconds: number;
		readonly id: string;
		readonly title: string;
		readonly __typename: "Video";
	})))[];
};

export type Search$artifact = typeof artifact

"HoudiniHash=7f8c1bbc2ab9c254d0cb1eca9818b24992857128f833667c3edac5c664da5911"`),
				},
			},
		},
	})
}
