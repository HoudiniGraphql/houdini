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
					"UserInfo_Refetch_Query": `const artifact = {
    "name": "UserInfo_Refetch_Query",
    "kind": "HoudiniQuery",
    "hash": "835ab9f8d3c95cebdcee39010d1e0256ed73c05c84b03f9422b22da5806943a7",

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

query UserInfo_Refetch_Query($id: ID!) {
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

export type UserInfo_Refetch_Query = {
	readonly "input": UserInfo_Refetch_Query$input;
	readonly "result": UserInfo_Refetch_Query$result | undefined;
};

export type UserInfo_Refetch_Query$result = {
	readonly node: {
		readonly " $fragments": {
			UserInfo: {};
		};
	} | null;
};

export type UserInfo_Refetch_Query$input = {
	id: string;
};

export type UserInfo_Refetch_Query$unmasked = {
	readonly node: {} & (({
		readonly firstName: string;
		readonly id: string;
		readonly __typename: "User";
	})) | null;
};

export type UserInfo_Refetch_Query$artifact = typeof artifact

"HoudiniHash=835ab9f8d3c95cebdcee39010d1e0256ed73c05c84b03f9422b22da5806943a7"`,
				},
			},
		},
	})
}
