package artifacts_test

import (
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins/tests"
)

func TestRefetchableArtifacts(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniCore]{
		Schema: `
      type Query {
        node(id: ID!): Node
        user: User
      }

      type User implements Node {
        id: ID!
        firstName: String!
      }

      interface Node {
        id: ID!
      }
    `,
		PerformTest: performArtifactTest,
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "refetchable fragment generates a query artifact with a non-paginated refetch block",
				Input: []string{
					`
            fragment UserInfo on User @refetchable {
              firstName
            }
          `,
				},
				Pass: true,
				Extra: map[string]any{
					"UserInfo_Pagination_Query": `const artifact = {
    "name": "UserInfo_Pagination_Query",
    "kind": "HoudiniQuery",
    "hash": "9575bb0b6d1a226a4c7489a1a0dc27ed4320abd5be65fc6ae56c02d86b46d185",

    "refetch": {
        "path": [],
        "method": "offset",
        "pageSize": 0,
        "embedded": false,
        "targetType": "Node",
        "paginated": false,
        "direction": "forward",
        "mode": "Infinite"
    },

    "raw": ` + "`" + `fragment UserInfo on User {
    firstName
    __typename
    id
}

query UserInfo_Pagination_Query($id: ID!) {
    node(id: $id) {
        ...UserInfo
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

                    "fragments": {
                        "UserInfo": {
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

export type UserInfo_Pagination_Query = {
	readonly "input": UserInfo_Pagination_Query$input;
	readonly "result": UserInfo_Pagination_Query$result | undefined;
};

export type UserInfo_Pagination_Query$result = {
	readonly node: {
		readonly " $fragments": {
			UserInfo: {};
		};
	} | null;
};

export type UserInfo_Pagination_Query$input = {
	id: string;
};

export type UserInfo_Pagination_Query$unmasked = {
	readonly node: {} & (({
		readonly firstName: string;
		readonly id: string;
		readonly __typename: "User";
	})) | null;
};

export type UserInfo_Pagination_Query$artifact = typeof artifact

"HoudiniHash=9575bb0b6d1a226a4c7489a1a0dc27ed4320abd5be65fc6ae56c02d86b46d185"`,
				},
			},
		},
	})
}
