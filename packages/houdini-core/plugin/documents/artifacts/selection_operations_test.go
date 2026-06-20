package artifacts_test

import (
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
)

func TestArtifactOperationsGeneration(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniCore]{
		Schema: `
      type Mutation {
         addFriend: AddFriendOutput!
         deleteUser(id: ID!): DeleteUserOutput!
      }

      type Query {
        users: [User!]!
      }

      type User {
        id: ID!
        firstName: String!
        field(filter: String): String
      }

      type AddFriendOutput {
        friend: User!
      }

      type DeleteUserOutput {
        userID: ID
      }
    `,
		PerformTest: performArtifactTest,
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "Mutation artifact properties",
				Pass: true,
				Input: []string{
					`mutation B {
            addFriend {
              friend {
                firstName
              }
            }
          }`,
				},
				Extra: map[string]any{
					"B": tests.Dedent(`const artifact = {
    "name": "B",
    "kind": "HoudiniMutation",
    "hash": "9ce380e593f0ad23179092018fff6667f3249e9fc261be13c40a7291c1f151c6",
    "raw": ` + "`" + `mutation B {
    addFriend {
        friend {
            firstName
            __typename
            id
        }
        __typename
    }
}
` + "`" + `,

    "rootType": "Mutation",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "addFriend": {
                "type": "AddFriendOutput",
                "keyRaw": "addFriend",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "friend": {
                            "type": "User",
                            "keyRaw": "friend",

                            "selection": {
                                "fields": {
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

                            "visible": true,
                        },
                    },
                },

                "visible": true,
            },
        },
    },

    "pluginData": {},
} as const

export default artifact

export type B = {
	readonly "input"?: B$input;
	readonly "result": B$result;
};

export type B$result = {
	readonly addFriend: {
		readonly friend: {
			readonly firstName: string;
		};
	};
};

export type B$input = null | undefined;

export type B$optimistic = {
	readonly addFriend?: {
		readonly friend?: {
			readonly firstName?: string;
		};
	};
};

export type B$unmasked = {
	readonly addFriend: {
		readonly __typename: "AddFriendOutput";
		readonly friend: {
			readonly __typename: "User";
			readonly firstName: string;
			readonly id: string;
		};
	};
};

export type B$artifact = typeof artifact

"HoudiniHash=9ce380e593f0ad23179092018fff6667f3249e9fc261be13c40a7291c1f151c6"`),
				},
			},
			{
				Name: "Insert operations",
				Pass: true,
				Input: []string{
					`mutation A {
              addFriend {
                friend {
                  ...All_Users_insert
                }
              }
            }`,
					`query TestQuery {
              users @list(name: "All_Users") {
                firstName
              }
            }`,
				},
				Extra: map[string]any{
					"A": tests.Dedent(`const artifact = {
    "name": "A",
    "kind": "HoudiniMutation",
    "hash": "425691bbfea3900b92488e1ab1c9d6ee50242cadb1de2336342766d9577656f1",
    "raw": ` + "`" + `mutation A {
    addFriend {
        friend {
            ...All_Users_insert
            __typename
            id
        }
        __typename
    }
}

fragment All_Users_insert on User {
    firstName
    __typename
    id
}
` + "`" + `,

    "rootType": "Mutation",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "addFriend": {
                "type": "AddFriendOutput",
                "keyRaw": "addFriend",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "friend": {
                            "type": "User",
                            "keyRaw": "friend",

                            "operations": [{
                                "action": "insert",
                                "list": "All_Users",
                                "position": "last"
                            }],

                            "selection": {
                                "fields": {
                                    "__typename": {
                                        "type": "String",
                                        "keyRaw": "__typename",
                                    },

                                    "firstName": {
                                        "type": "String",
                                        "keyRaw": "firstName",
                                    },

                                    "id": {
                                        "type": "ID",
                                        "keyRaw": "id",
                                    },
                                },

                                "fragments": {
                                    "All_Users_insert": {
                                        "arguments": {}
                                    },
                                },
                            },

                            "visible": true,
                        },
                    },
                },

                "visible": true,
            },
        },
    },

    "pluginData": {},
} as const

export default artifact

export type A = {
	readonly "input"?: A$input;
	readonly "result": A$result;
};

export type A$result = {
	readonly addFriend: {
		readonly friend: {
			readonly " $fragments": {
				All_Users_insert: {};
			};
		};
	};
};

export type A$input = null | undefined;

export type A$optimistic = {
	readonly addFriend?: {
		readonly friend?: {
			readonly firstName?: string;
		};
	};
};

export type A$unmasked = {
	readonly addFriend: {
		readonly __typename: "AddFriendOutput";
		readonly friend: {
			readonly __typename: "User";
			readonly firstName: string;
			readonly id: string;
		};
	};
};

export type A$artifact = typeof artifact

"HoudiniHash=425691bbfea3900b92488e1ab1c9d6ee50242cadb1de2336342766d9577656f1"`),
				},
			},
			{
				Name: "Insert operations and @with directive",
				Pass: true,
				Input: []string{
					`mutation A {
              addFriend {
                friend {
                    ...All_Users_insert @with(filter: "Hello World")
                }
              }
            }`,
					`query TestQuery($filter: String) {
              users @list(name: "All_Users") {
                firstName
                field(filter: $filter)
              }
            }`,
				},
				Extra: map[string]any{
					"A": tests.Dedent(`const artifact = {
    "name": "A",
    "kind": "HoudiniMutation",
    "hash": "478267e6079162675775c31eaffa1e1108c883b24f7b3ff81f1caed9ad415cd6",
    "raw": ` + "`" + `mutation A {
    addFriend {
        friend {
            ...All_Users_insert_kVR6H
            __typename
            id
        }
        __typename
    }
}

fragment All_Users_insert_kVR6H on User {
    firstName
    __typename
    id
    field(filter: "Hello World")
}
` + "`" + `,

    "rootType": "Mutation",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "addFriend": {
                "type": "AddFriendOutput",
                "keyRaw": "addFriend",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "friend": {
                            "type": "User",
                            "keyRaw": "friend",

                            "operations": [{
                                "action": "insert",
                                "list": "All_Users",
                                "position": "last"
                            }],

                            "selection": {
                                "fields": {
                                    "__typename": {
                                        "type": "String",
                                        "keyRaw": "__typename",
                                    },

                                    "field": {
                                        "type": "String",
                                        "keyRaw": "field(filter: \"Hello World\")",
                                        "nullable": true,
                                    },

                                    "firstName": {
                                        "type": "String",
                                        "keyRaw": "firstName",
                                    },

                                    "id": {
                                        "type": "ID",
                                        "keyRaw": "id",
                                    },
                                },

                                "fragments": {
                                    "All_Users_insert": {
                                        "arguments": {
                                            "filter": {
                                                "kind": "StringValue",
                                                "value": "Hello World"
                                            },
                                        }
                                    },
                                },
                            },

                            "visible": true,
                        },
                    },
                },

                "visible": true,
            },
        },
    },

    "pluginData": {},
} as const

export default artifact

export type A = {
	readonly "input"?: A$input;
	readonly "result": A$result;
};

export type A$result = {
	readonly addFriend: {
		readonly friend: {
			readonly " $fragments": {
				All_Users_insert: {};
			};
		};
	};
};

export type A$input = null | undefined;

export type A$optimistic = {
	readonly addFriend?: {
		readonly friend?: {
			readonly firstName?: string;
			readonly field?: string | null;
		};
	};
};

export type A$unmasked = {
	readonly addFriend: {
		readonly __typename: "AddFriendOutput";
		readonly friend: {
			readonly __typename: "User";
			readonly field: string | null;
			readonly firstName: string;
			readonly id: string;
		};
	};
};

export type A$artifact = typeof artifact

"HoudiniHash=478267e6079162675775c31eaffa1e1108c883b24f7b3ff81f1caed9ad415cd6"`),
				},
			},
			{
				Name: "Insert operations with variable condition",
				Pass: true,
				Input: []string{
					`mutation B($name: String!) {
              addFriend {
                friend {
                  ...All_Users_insert @when(stringValue: $name)
                }
              }
            }`,
					`query TestQuery {
              users @list(name: "All_Users") {
                firstName
              }
            }`,
				},
				Extra: map[string]any{
					"B": tests.Dedent(`const artifact = {
    "name": "B",
    "kind": "HoudiniMutation",
    "hash": "680082591789d4a74f7136909b1e6349e6561f44b777de23138d5dda947e4150",
    "raw": ` + "`" + `fragment All_Users_insert on User {
    firstName
    __typename
    id
}

mutation B {
    addFriend {
        friend {
            ...All_Users_insert
            __typename
            id
        }
        __typename
    }
}
` + "`" + `,

    "rootType": "Mutation",
    "stripVariables": ["name"] as Array<string>,

    "selection": {
        "fields": {
            "addFriend": {
                "type": "AddFriendOutput",
                "keyRaw": "addFriend",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "friend": {
                            "type": "User",
                            "keyRaw": "friend",

                            "operations": [{
                                "action": "insert",
                                "list": "All_Users",
                                "position": "last",

                                "when": {
                                    "must": {
                                        "stringValue": {
                                            "kind": "Variable",
                                            "value": "name"
                                        },
                                    },
                                },
                            }],

                            "selection": {
                                "fields": {
                                    "__typename": {
                                        "type": "String",
                                        "keyRaw": "__typename",
                                    },

                                    "firstName": {
                                        "type": "String",
                                        "keyRaw": "firstName",
                                    },

                                    "id": {
                                        "type": "ID",
                                        "keyRaw": "id",
                                    },
                                },

                                "fragments": {
                                    "All_Users_insert": {
                                        "arguments": {}
                                    },
                                },
                            },

                            "visible": true,
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
            "name": "String",
        },

        "types": {},

        "defaults": {},

        "runtimeScalars": {},
    },

} as const

export default artifact

export type B = {
	readonly "input": B$input;
	readonly "result": B$result;
};

export type B$result = {
	readonly addFriend: {
		readonly friend: {
			readonly " $fragments": {
				All_Users_insert: {};
			};
		};
	};
};

export type B$input = {
	name: string;
};

export type B$optimistic = {
	readonly addFriend?: {
		readonly friend?: {
			readonly firstName?: string;
		};
	};
};

export type B$unmasked = {
	readonly addFriend: {
		readonly __typename: "AddFriendOutput";
		readonly friend: {
			readonly __typename: "User";
			readonly firstName: string;
			readonly id: string;
		};
	};
};

export type B$artifact = typeof artifact

"HoudiniHash=680082591789d4a74f7136909b1e6349e6561f44b777de23138d5dda947e4150"`),
				},
			},
			{
				Name: "Insert operations with condition",
				Pass: true,
				Input: []string{
					`mutation A {
              addFriend {
                friend {
                  ...All_Users_insert @when(stringValue: "foo")
                }
              }
            }`,
					`query TestQuery {
              users @list(name: "All_Users") {
                firstName
              }
            }`,
				},
				Extra: map[string]any{
					"A": tests.Dedent(`const artifact = {
    "name": "A",
    "kind": "HoudiniMutation",
    "hash": "425691bbfea3900b92488e1ab1c9d6ee50242cadb1de2336342766d9577656f1",
    "raw": ` + "`" + `mutation A {
    addFriend {
        friend {
            ...All_Users_insert
            __typename
            id
        }
        __typename
    }
}

fragment All_Users_insert on User {
    firstName
    __typename
    id
}
` + "`" + `,

    "rootType": "Mutation",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "addFriend": {
                "type": "AddFriendOutput",
                "keyRaw": "addFriend",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "friend": {
                            "type": "User",
                            "keyRaw": "friend",

                            "operations": [{
                                "action": "insert",
                                "list": "All_Users",
                                "position": "last",

                                "when": {
                                    "must": {
                                        "stringValue": {
                                            "kind": "String",
                                            "value": "foo"
                                        },
                                    },
                                },
                            }],

                            "selection": {
                                "fields": {
                                    "__typename": {
                                        "type": "String",
                                        "keyRaw": "__typename",
                                    },

                                    "firstName": {
                                        "type": "String",
                                        "keyRaw": "firstName",
                                    },

                                    "id": {
                                        "type": "ID",
                                        "keyRaw": "id",
                                    },
                                },

                                "fragments": {
                                    "All_Users_insert": {
                                        "arguments": {}
                                    },
                                },
                            },

                            "visible": true,
                        },
                    },
                },

                "visible": true,
            },
        },
    },

    "pluginData": {},
} as const

export default artifact

export type A = {
	readonly "input"?: A$input;
	readonly "result": A$result;
};

export type A$result = {
	readonly addFriend: {
		readonly friend: {
			readonly " $fragments": {
				All_Users_insert: {};
			};
		};
	};
};

export type A$input = null | undefined;

export type A$optimistic = {
	readonly addFriend?: {
		readonly friend?: {
			readonly firstName?: string;
		};
	};
};

export type A$unmasked = {
	readonly addFriend: {
		readonly __typename: "AddFriendOutput";
		readonly friend: {
			readonly __typename: "User";
			readonly firstName: string;
			readonly id: string;
		};
	};
};

export type A$artifact = typeof artifact

"HoudiniHash=425691bbfea3900b92488e1ab1c9d6ee50242cadb1de2336342766d9577656f1"`),
				},
			},
			{
				Name: "Insert operations with non condition",
				Pass: true,
				Input: []string{
					`mutation A {
              addFriend {
                friend {
                  ...All_Users_insert @when_not(stringValue: "foo")
                }
              }
            }`,
					`query TestQuery {
              users @list(name: "All_Users") {
                firstName
              }
            }`,
				},
				Extra: map[string]any{
					"A": tests.Dedent(`const artifact = {
    "name": "A",
    "kind": "HoudiniMutation",
    "hash": "425691bbfea3900b92488e1ab1c9d6ee50242cadb1de2336342766d9577656f1",
    "raw": ` + "`" + `mutation A {
    addFriend {
        friend {
            ...All_Users_insert
            __typename
            id
        }
        __typename
    }
}

fragment All_Users_insert on User {
    firstName
    __typename
    id
}
` + "`" + `,

    "rootType": "Mutation",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "addFriend": {
                "type": "AddFriendOutput",
                "keyRaw": "addFriend",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "friend": {
                            "type": "User",
                            "keyRaw": "friend",

                            "operations": [{
                                "action": "insert",
                                "list": "All_Users",
                                "position": "last",

                                "when": {
                                    "must_not": {
                                        "stringValue": {
                                            "kind": "String",
                                            "value": "foo"
                                        },
                                    },
                                },
                            }],

                            "selection": {
                                "fields": {
                                    "__typename": {
                                        "type": "String",
                                        "keyRaw": "__typename",
                                    },

                                    "firstName": {
                                        "type": "String",
                                        "keyRaw": "firstName",
                                    },

                                    "id": {
                                        "type": "ID",
                                        "keyRaw": "id",
                                    },
                                },

                                "fragments": {
                                    "All_Users_insert": {
                                        "arguments": {}
                                    },
                                },
                            },

                            "visible": true,
                        },
                    },
                },

                "visible": true,
            },
        },
    },

    "pluginData": {},
} as const

export default artifact

export type A = {
	readonly "input"?: A$input;
	readonly "result": A$result;
};

export type A$result = {
	readonly addFriend: {
		readonly friend: {
			readonly " $fragments": {
				All_Users_insert: {};
			};
		};
	};
};

export type A$input = null | undefined;

export type A$optimistic = {
	readonly addFriend?: {
		readonly friend?: {
			readonly firstName?: string;
		};
	};
};

export type A$unmasked = {
	readonly addFriend: {
		readonly __typename: "AddFriendOutput";
		readonly friend: {
			readonly __typename: "User";
			readonly firstName: string;
			readonly id: string;
		};
	};
};

export type A$artifact = typeof artifact

"HoudiniHash=425691bbfea3900b92488e1ab1c9d6ee50242cadb1de2336342766d9577656f1"`),
				},
			},
			{
				Name: "Insert operations with both condition",
				Pass: true,
				Input: []string{
					`mutation A {
              addFriend {
                friend {
                  ...All_Users_insert @when(stringValue: "foo") @when_not(a: "foo")
                }
              }
            }`,
					`query TestQuery {
              users @list(name: "All_Users") {
                firstName
              }
            }`,
				},
				Extra: map[string]any{
					"A": tests.Dedent(`const artifact = {
    "name": "A",
    "kind": "HoudiniMutation",
    "hash": "425691bbfea3900b92488e1ab1c9d6ee50242cadb1de2336342766d9577656f1",
    "raw": ` + "`" + `mutation A {
    addFriend {
        friend {
            ...All_Users_insert
            __typename
            id
        }
        __typename
    }
}

fragment All_Users_insert on User {
    firstName
    __typename
    id
}
` + "`" + `,

    "rootType": "Mutation",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "addFriend": {
                "type": "AddFriendOutput",
                "keyRaw": "addFriend",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "friend": {
                            "type": "User",
                            "keyRaw": "friend",

                            "operations": [{
                                "action": "insert",
                                "list": "All_Users",
                                "position": "last",

                                "when": {
                                    "must": {
                                        "stringValue": {
                                            "kind": "String",
                                            "value": "foo"
                                        },
                                    },
                                    "must_not": {
                                        "a": {
                                            "kind": "String",
                                            "value": "foo"
                                        },
                                    },
                                },
                            }],

                            "selection": {
                                "fields": {
                                    "__typename": {
                                        "type": "String",
                                        "keyRaw": "__typename",
                                    },

                                    "firstName": {
                                        "type": "String",
                                        "keyRaw": "firstName",
                                    },

                                    "id": {
                                        "type": "ID",
                                        "keyRaw": "id",
                                    },
                                },

                                "fragments": {
                                    "All_Users_insert": {
                                        "arguments": {}
                                    },
                                },
                            },

                            "visible": true,
                        },
                    },
                },

                "visible": true,
            },
        },
    },

    "pluginData": {},
} as const

export default artifact

export type A = {
	readonly "input"?: A$input;
	readonly "result": A$result;
};

export type A$result = {
	readonly addFriend: {
		readonly friend: {
			readonly " $fragments": {
				All_Users_insert: {};
			};
		};
	};
};

export type A$input = null | undefined;

export type A$optimistic = {
	readonly addFriend?: {
		readonly friend?: {
			readonly firstName?: string;
		};
	};
};

export type A$unmasked = {
	readonly addFriend: {
		readonly __typename: "AddFriendOutput";
		readonly friend: {
			readonly __typename: "User";
			readonly firstName: string;
			readonly id: string;
		};
	};
};

export type A$artifact = typeof artifact

"HoudiniHash=425691bbfea3900b92488e1ab1c9d6ee50242cadb1de2336342766d9577656f1"`),
				},
			},
			{
				Name: "Insert operations allList and @with directive",
				Pass: true,
				Input: []string{
					`mutation A {
              addFriend {
                friend {
                    ...All_Users_insert @with(filter: "Hello World") @allLists
                }
              }
            }`,
					`query TestQuery($filter: String) {
              users @list(name: "All_Users") {
                firstName
                field(filter: $filter)
              }
            }`,
				},
				Extra: map[string]any{
					"A": tests.Dedent(`const artifact = {
    "name": "A",
    "kind": "HoudiniMutation",
    "hash": "478267e6079162675775c31eaffa1e1108c883b24f7b3ff81f1caed9ad415cd6",
    "raw": ` + "`" + `mutation A {
    addFriend {
        friend {
            ...All_Users_insert_kVR6H
            __typename
            id
        }
        __typename
    }
}

fragment All_Users_insert_kVR6H on User {
    firstName
    __typename
    id
    field(filter: "Hello World")
}
` + "`" + `,

    "rootType": "Mutation",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "addFriend": {
                "type": "AddFriendOutput",
                "keyRaw": "addFriend",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "friend": {
                            "type": "User",
                            "keyRaw": "friend",

                            "operations": [{
                                "action": "insert",
                                "list": "All_Users",
                                "position": "last",
                                "target": "all"
                            }],

                            "selection": {
                                "fields": {
                                    "__typename": {
                                        "type": "String",
                                        "keyRaw": "__typename",
                                    },

                                    "field": {
                                        "type": "String",
                                        "keyRaw": "field(filter: \"Hello World\")",
                                        "nullable": true,
                                    },

                                    "firstName": {
                                        "type": "String",
                                        "keyRaw": "firstName",
                                    },

                                    "id": {
                                        "type": "ID",
                                        "keyRaw": "id",
                                    },
                                },

                                "fragments": {
                                    "All_Users_insert": {
                                        "arguments": {
                                            "filter": {
                                                "kind": "StringValue",
                                                "value": "Hello World"
                                            },
                                        }
                                    },
                                },
                            },

                            "visible": true,
                        },
                    },
                },

                "visible": true,
            },
        },
    },

    "pluginData": {},
} as const

export default artifact

export type A = {
	readonly "input"?: A$input;
	readonly "result": A$result;
};

export type A$result = {
	readonly addFriend: {
		readonly friend: {
			readonly " $fragments": {
				All_Users_insert: {};
			};
		};
	};
};

export type A$input = null | undefined;

export type A$optimistic = {
	readonly addFriend?: {
		readonly friend?: {
			readonly firstName?: string;
			readonly field?: string | null;
		};
	};
};

export type A$unmasked = {
	readonly addFriend: {
		readonly __typename: "AddFriendOutput";
		readonly friend: {
			readonly __typename: "User";
			readonly field: string | null;
			readonly firstName: string;
			readonly id: string;
		};
	};
};

export type A$artifact = typeof artifact

"HoudiniHash=478267e6079162675775c31eaffa1e1108c883b24f7b3ff81f1caed9ad415cd6"`),
				},
			},
			{
				Name: "Optimistic keys",
				Pass: true,
				Input: []string{
					`mutation A {
            addFriend {
              friend {
                id @optimisticKey
              }
            }
          }`,
				},
				Extra: map[string]any{
					"A": tests.Dedent(`const artifact = {
    "name": "A",
    "kind": "HoudiniMutation",
    "hash": "8a080e59ca9f1fbf5e83ed5f778594c5fb2271fc6f48291ca27c18d0b1583c32",
    "raw": ` + "`" + `mutation A {
    addFriend {
        friend {
            id
            __typename
        }
        __typename
    }
}
` + "`" + `,

    "rootType": "Mutation",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "addFriend": {
                "type": "AddFriendOutput",
                "keyRaw": "addFriend",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "friend": {
                            "type": "User",
                            "keyRaw": "friend",

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
                                            "name": "optimisticKey",
                                            "arguments": {}
                                        }],

                                        "optimisticKey": true,
                                        "visible": true,
                                    },
                                },
                            },

                            "visible": true,
                        },
                    },
                },

                "visible": true,
            },
        },
    },

    "pluginData": {},
    "optimisticKeys": true
} as const

export default artifact

export type A = {
	readonly "input"?: A$input;
	readonly "result": A$result;
};

export type A$result = {
	readonly addFriend: {
		readonly friend: {
			readonly id: string;
		};
	};
};

export type A$input = null | undefined;

export type A$optimistic = {
	readonly addFriend?: {
		readonly friend?: {};
	};
};

export type A$unmasked = {
	readonly addFriend: {
		readonly __typename: "AddFriendOutput";
		readonly friend: {
			readonly __typename: "User";
			readonly id: string;
		};
	};
};

export type A$artifact = typeof artifact

"HoudiniHash=8a080e59ca9f1fbf5e83ed5f778594c5fb2271fc6f48291ca27c18d0b1583c32"`),
				},
			},
			{
				Name: "Insert operation allList",
				Pass: true,
				Input: []string{
					`mutation A {
              addFriend {
                friend {
                  ...All_Users_insert @allLists
                }
              }
            }`,
					`query TestQuery {
              users @list(name: "All_Users") {
                firstName
              }
            }`,
				},
				Extra: map[string]any{
					"A": tests.Dedent(`const artifact = {
    "name": "A",
    "kind": "HoudiniMutation",
    "hash": "425691bbfea3900b92488e1ab1c9d6ee50242cadb1de2336342766d9577656f1",
    "raw": ` + "`" + `mutation A {
    addFriend {
        friend {
            ...All_Users_insert
            __typename
            id
        }
        __typename
    }
}

fragment All_Users_insert on User {
    firstName
    __typename
    id
}
` + "`" + `,

    "rootType": "Mutation",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "addFriend": {
                "type": "AddFriendOutput",
                "keyRaw": "addFriend",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "friend": {
                            "type": "User",
                            "keyRaw": "friend",

                            "operations": [{
                                "action": "insert",
                                "list": "All_Users",
                                "position": "last",
                                "target": "all"
                            }],

                            "selection": {
                                "fields": {
                                    "__typename": {
                                        "type": "String",
                                        "keyRaw": "__typename",
                                    },

                                    "firstName": {
                                        "type": "String",
                                        "keyRaw": "firstName",
                                    },

                                    "id": {
                                        "type": "ID",
                                        "keyRaw": "id",
                                    },
                                },

                                "fragments": {
                                    "All_Users_insert": {
                                        "arguments": {}
                                    },
                                },
                            },

                            "visible": true,
                        },
                    },
                },

                "visible": true,
            },
        },
    },

    "pluginData": {},
} as const

export default artifact

export type A = {
	readonly "input"?: A$input;
	readonly "result": A$result;
};

export type A$result = {
	readonly addFriend: {
		readonly friend: {
			readonly " $fragments": {
				All_Users_insert: {};
			};
		};
	};
};

export type A$input = null | undefined;

export type A$optimistic = {
	readonly addFriend?: {
		readonly friend?: {
			readonly firstName?: string;
		};
	};
};

export type A$unmasked = {
	readonly addFriend: {
		readonly __typename: "AddFriendOutput";
		readonly friend: {
			readonly __typename: "User";
			readonly firstName: string;
			readonly id: string;
		};
	};
};

export type A$artifact = typeof artifact

"HoudiniHash=425691bbfea3900b92488e1ab1c9d6ee50242cadb1de2336342766d9577656f1"`),
				},
			},
			{
				Name: "remove operation allList",
				Pass: true,
				Input: []string{
					`mutation A {
              addFriend {
                friend {
                  ...All_Users_remove @allLists
                }
              }
            }`,
					`query TestQuery {
              users @list(name: "All_Users") {
                firstName
              }
            }`,
				},
				Extra: map[string]any{
					"A": tests.Dedent(`const artifact = {
    "name": "A",
    "kind": "HoudiniMutation",
    "hash": "5b4c90b131ad3fa0c82375c8a3ead0b8f6a2f62c87e60af202ea0989beb3e71e",
    "raw": ` + "`" + `mutation A {
    addFriend {
        friend {
            ...All_Users_remove
            __typename
            id
        }
        __typename
    }
}

fragment All_Users_remove on User {
    id
    __typename
}
` + "`" + `,

    "rootType": "Mutation",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "addFriend": {
                "type": "AddFriendOutput",
                "keyRaw": "addFriend",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "friend": {
                            "type": "User",
                            "keyRaw": "friend",

                            "operations": [{
                                "action": "remove",
                                "list": "All_Users",
                                "target": "all"
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
                                },

                                "fragments": {
                                    "All_Users_remove": {
                                        "arguments": {}
                                    },
                                },
                            },

                            "visible": true,
                        },
                    },
                },

                "visible": true,
            },
        },
    },

    "pluginData": {},
} as const

export default artifact

export type A = {
	readonly "input"?: A$input;
	readonly "result": A$result;
};

export type A$result = {
	readonly addFriend: {
		readonly friend: {
			readonly " $fragments": {
				All_Users_remove: {};
			};
		};
	};
};

export type A$input = null | undefined;

export type A$optimistic = {
	readonly addFriend?: {
		readonly friend?: {};
	};
};

export type A$unmasked = {
	readonly addFriend: {
		readonly __typename: "AddFriendOutput";
		readonly friend: {
			readonly __typename: "User";
			readonly id: string;
		};
	};
};

export type A$artifact = typeof artifact

"HoudiniHash=5b4c90b131ad3fa0c82375c8a3ead0b8f6a2f62c87e60af202ea0989beb3e71e"`),
				},
			},
			{
				Name: "toggle operation allList",
				Pass: true,
				Input: []string{
					`mutation A {
              addFriend {
                friend {
                  ...All_Users_toggle @allLists @prepend
                }
              }
            }`,
					`query TestQuery {
              users @list(name: "All_Users") {
                firstName
              }
            }`,
				},
				Extra: map[string]any{
					"A": tests.Dedent(`const artifact = {
    "name": "A",
    "kind": "HoudiniMutation",
    "hash": "716a789bd735c599d781df5adeb1fd159af7b32d1dc72f4ad425ed5354c126b8",
    "raw": ` + "`" + `mutation A {
    addFriend {
        friend {
            ...All_Users_toggle
            __typename
            id
        }
        __typename
    }
}

fragment All_Users_toggle on User {
    firstName
    __typename
    id
}
` + "`" + `,

    "rootType": "Mutation",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "addFriend": {
                "type": "AddFriendOutput",
                "keyRaw": "addFriend",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "friend": {
                            "type": "User",
                            "keyRaw": "friend",

                            "operations": [{
                                "action": "toggle",
                                "list": "All_Users",
                                "position": "first",
                                "target": "all"
                            }],

                            "selection": {
                                "fields": {
                                    "__typename": {
                                        "type": "String",
                                        "keyRaw": "__typename",
                                    },

                                    "firstName": {
                                        "type": "String",
                                        "keyRaw": "firstName",
                                    },

                                    "id": {
                                        "type": "ID",
                                        "keyRaw": "id",
                                    },
                                },

                                "fragments": {
                                    "All_Users_toggle": {
                                        "arguments": {}
                                    },
                                },
                            },

                            "visible": true,
                        },
                    },
                },

                "visible": true,
            },
        },
    },

    "pluginData": {},
} as const

export default artifact

export type A = {
	readonly "input"?: A$input;
	readonly "result": A$result;
};

export type A$result = {
	readonly addFriend: {
		readonly friend: {
			readonly " $fragments": {
				All_Users_toggle: {};
			};
		};
	};
};

export type A$input = null | undefined;

export type A$optimistic = {
	readonly addFriend?: {
		readonly friend?: {
			readonly firstName?: string;
		};
	};
};

export type A$unmasked = {
	readonly addFriend: {
		readonly __typename: "AddFriendOutput";
		readonly friend: {
			readonly __typename: "User";
			readonly firstName: string;
			readonly id: string;
		};
	};
};

export type A$artifact = typeof artifact

"HoudiniHash=716a789bd735c599d781df5adeb1fd159af7b32d1dc72f4ad425ed5354c126b8"`),
				},
			},
			{
				Name: "toggle operation allList and @with directive",
				Pass: true,
				Input: []string{
					`mutation A {
              addFriend {
                friend {
                  ...All_Users_toggle @with(filter: "Hello World") @allLists @prepend
                }
              }
            }`,
					`query TestQuery($filter: String) {
              users @list(name: "All_Users") {
                firstName
						    field(filter: $filter)
              }
            }`,
				},
				Extra: map[string]any{
					"A": tests.Dedent(`const artifact = {
    "name": "A",
    "kind": "HoudiniMutation",
    "hash": "2a2d7cbe16d4430cd3c817bc3f5ea605fadb3a84bf2574a15413322cc513da88",
    "raw": ` + "`" + `mutation A {
    addFriend {
        friend {
            ...All_Users_toggle_kVR6H
            __typename
            id
        }
        __typename
    }
}

fragment All_Users_toggle_kVR6H on User {
    firstName
    __typename
    id
    field(filter: "Hello World")
}
` + "`" + `,

    "rootType": "Mutation",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "addFriend": {
                "type": "AddFriendOutput",
                "keyRaw": "addFriend",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "friend": {
                            "type": "User",
                            "keyRaw": "friend",

                            "operations": [{
                                "action": "toggle",
                                "list": "All_Users",
                                "position": "first",
                                "target": "all"
                            }],

                            "selection": {
                                "fields": {
                                    "__typename": {
                                        "type": "String",
                                        "keyRaw": "__typename",
                                    },

                                    "field": {
                                        "type": "String",
                                        "keyRaw": "field(filter: \"Hello World\")",
                                        "nullable": true,
                                    },

                                    "firstName": {
                                        "type": "String",
                                        "keyRaw": "firstName",
                                    },

                                    "id": {
                                        "type": "ID",
                                        "keyRaw": "id",
                                    },
                                },

                                "fragments": {
                                    "All_Users_toggle": {
                                        "arguments": {
                                            "filter": {
                                                "kind": "StringValue",
                                                "value": "Hello World"
                                            },
                                        }
                                    },
                                },
                            },

                            "visible": true,
                        },
                    },
                },

                "visible": true,
            },
        },
    },

    "pluginData": {},
} as const

export default artifact

export type A = {
	readonly "input"?: A$input;
	readonly "result": A$result;
};

export type A$result = {
	readonly addFriend: {
		readonly friend: {
			readonly " $fragments": {
				All_Users_toggle: {};
			};
		};
	};
};

export type A$input = null | undefined;

export type A$optimistic = {
	readonly addFriend?: {
		readonly friend?: {
			readonly firstName?: string;
			readonly field?: string | null;
		};
	};
};

export type A$unmasked = {
	readonly addFriend: {
		readonly __typename: "AddFriendOutput";
		readonly friend: {
			readonly __typename: "User";
			readonly field: string | null;
			readonly firstName: string;
			readonly id: string;
		};
	};
};

export type A$artifact = typeof artifact

"HoudiniHash=2a2d7cbe16d4430cd3c817bc3f5ea605fadb3a84bf2574a15413322cc513da88"`),
				},
			},
			{
				Name: "allList as default list target",
				Pass: true,
				Input: []string{
					`mutation A {
              addFriend {
                friend {
                  ...All_Users_toggle @prepend
                }
              }
            }`,
					`query TestQuery {
              users @list(name: "All_Users") {
                firstName
              }
            }`,
				},
				ProjectConfig: func(config *plugins.ProjectConfig) {
					config.DefaultListTarget = "all"
				},
				Extra: map[string]any{
					"A": tests.Dedent(`const artifact = {
    "name": "A",
    "kind": "HoudiniMutation",
    "hash": "716a789bd735c599d781df5adeb1fd159af7b32d1dc72f4ad425ed5354c126b8",
    "raw": ` + "`" + `mutation A {
    addFriend {
        friend {
            ...All_Users_toggle
            __typename
            id
        }
        __typename
    }
}

fragment All_Users_toggle on User {
    firstName
    __typename
    id
}
` + "`" + `,

    "rootType": "Mutation",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "addFriend": {
                "type": "AddFriendOutput",
                "keyRaw": "addFriend",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "friend": {
                            "type": "User",
                            "keyRaw": "friend",

                            "operations": [{
                                "action": "toggle",
                                "list": "All_Users",
                                "position": "first",
                                "target": "all"
                            }],

                            "selection": {
                                "fields": {
                                    "__typename": {
                                        "type": "String",
                                        "keyRaw": "__typename",
                                    },

                                    "firstName": {
                                        "type": "String",
                                        "keyRaw": "firstName",
                                    },

                                    "id": {
                                        "type": "ID",
                                        "keyRaw": "id",
                                    },
                                },

                                "fragments": {
                                    "All_Users_toggle": {
                                        "arguments": {}
                                    },
                                },
                            },

                            "visible": true,
                        },
                    },
                },

                "visible": true,
            },
        },
    },

    "pluginData": {},
} as const

export default artifact

export type A = {
	readonly "input"?: A$input;
	readonly "result": A$result;
};

export type A$result = {
	readonly addFriend: {
		readonly friend: {
			readonly " $fragments": {
				All_Users_toggle: {};
			};
		};
	};
};

export type A$input = null | undefined;

export type A$optimistic = {
	readonly addFriend?: {
		readonly friend?: {
			readonly firstName?: string;
		};
	};
};

export type A$unmasked = {
	readonly addFriend: {
		readonly __typename: "AddFriendOutput";
		readonly friend: {
			readonly __typename: "User";
			readonly firstName: string;
			readonly id: string;
		};
	};
};

export type A$artifact = typeof artifact

"HoudiniHash=716a789bd735c599d781df5adeb1fd159af7b32d1dc72f4ad425ed5354c126b8"`),
				},
			},
			{
				Name: "default position config",
				Pass: true,
				Input: []string{
					`mutation A {
              addFriend {
                friend {
                  ...All_Users_toggle
                }
              }
            }`,
					`query TestQuery {
              users @list(name: "All_Users") {
                firstName
              }
            }`,
				},
				ProjectConfig: func(config *plugins.ProjectConfig) {
					config.DefaultListPosition = "last"
				},
				Extra: map[string]any{
					"A": tests.Dedent(`const artifact = {
    "name": "A",
    "kind": "HoudiniMutation",
    "hash": "716a789bd735c599d781df5adeb1fd159af7b32d1dc72f4ad425ed5354c126b8",
    "raw": ` + "`" + `mutation A {
    addFriend {
        friend {
            ...All_Users_toggle
            __typename
            id
        }
        __typename
    }
}

fragment All_Users_toggle on User {
    firstName
    __typename
    id
}
` + "`" + `,

    "rootType": "Mutation",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "addFriend": {
                "type": "AddFriendOutput",
                "keyRaw": "addFriend",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "friend": {
                            "type": "User",
                            "keyRaw": "friend",

                            "operations": [{
                                "action": "toggle",
                                "list": "All_Users",
                                "position": "last"
                            }],

                            "selection": {
                                "fields": {
                                    "__typename": {
                                        "type": "String",
                                        "keyRaw": "__typename",
                                    },

                                    "firstName": {
                                        "type": "String",
                                        "keyRaw": "firstName",
                                    },

                                    "id": {
                                        "type": "ID",
                                        "keyRaw": "id",
                                    },
                                },

                                "fragments": {
                                    "All_Users_toggle": {
                                        "arguments": {}
                                    },
                                },
                            },

                            "visible": true,
                        },
                    },
                },

                "visible": true,
            },
        },
    },

    "pluginData": {},
} as const

export default artifact

export type A = {
	readonly "input"?: A$input;
	readonly "result": A$result;
};

export type A$result = {
	readonly addFriend: {
		readonly friend: {
			readonly " $fragments": {
				All_Users_toggle: {};
			};
		};
	};
};

export type A$input = null | undefined;

export type A$optimistic = {
	readonly addFriend?: {
		readonly friend?: {
			readonly firstName?: string;
		};
	};
};

export type A$unmasked = {
	readonly addFriend: {
		readonly __typename: "AddFriendOutput";
		readonly friend: {
			readonly __typename: "User";
			readonly firstName: string;
			readonly id: string;
		};
	};
};

export type A$artifact = typeof artifact

"HoudiniHash=716a789bd735c599d781df5adeb1fd159af7b32d1dc72f4ad425ed5354c126b8"`),
				},
			},
			{
				Name: "remove operation",
				Pass: true,
				Input: []string{
					`mutation A {
              addFriend {
                friend {
                  ...All_Users_remove
                }
              }
            }`,
					`query TestQuery {
              users @list(name: "All_Users") {
                firstName
              }
            }`,
				},
				Extra: map[string]any{
					"A": tests.Dedent(`const artifact = {
    "name": "A",
    "kind": "HoudiniMutation",
    "hash": "5b4c90b131ad3fa0c82375c8a3ead0b8f6a2f62c87e60af202ea0989beb3e71e",
    "raw": ` + "`" + `mutation A {
    addFriend {
        friend {
            ...All_Users_remove
            __typename
            id
        }
        __typename
    }
}

fragment All_Users_remove on User {
    id
    __typename
}
` + "`" + `,

    "rootType": "Mutation",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "addFriend": {
                "type": "AddFriendOutput",
                "keyRaw": "addFriend",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "friend": {
                            "type": "User",
                            "keyRaw": "friend",

                            "operations": [{
                                "action": "remove",
                                "list": "All_Users"
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
                                },

                                "fragments": {
                                    "All_Users_remove": {
                                        "arguments": {}
                                    },
                                },
                            },

                            "visible": true,
                        },
                    },
                },

                "visible": true,
            },
        },
    },

    "pluginData": {},
} as const

export default artifact

export type A = {
	readonly "input"?: A$input;
	readonly "result": A$result;
};

export type A$result = {
	readonly addFriend: {
		readonly friend: {
			readonly " $fragments": {
				All_Users_remove: {};
			};
		};
	};
};

export type A$input = null | undefined;

export type A$optimistic = {
	readonly addFriend?: {
		readonly friend?: {};
	};
};

export type A$unmasked = {
	readonly addFriend: {
		readonly __typename: "AddFriendOutput";
		readonly friend: {
			readonly __typename: "User";
			readonly id: string;
		};
	};
};

export type A$artifact = typeof artifact

"HoudiniHash=5b4c90b131ad3fa0c82375c8a3ead0b8f6a2f62c87e60af202ea0989beb3e71e"`),
				},
			},
			{
				Name: "delete operation",
				Pass: true,
				Input: []string{
					`mutation A {
              deleteUser(id: "1234") {
                userID @User_delete
              }
            }`,
					`query TestQuery {
              users @list(name: "All_Users") {
                firstName
              }
            }`,
				},
				Extra: map[string]any{
					"A": tests.Dedent(`const artifact = {
    "name": "A",
    "kind": "HoudiniMutation",
    "hash": "74a70a5832df8760e9a80f1b32360a58e5c6ecd48551606448ce2cd6bbae28c2",
    "raw": ` + "`" + `mutation A {
    deleteUser(id: "1234") {
        userID
        __typename
    }
}
` + "`" + `,

    "rootType": "Mutation",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "deleteUser": {
                "type": "DeleteUserOutput",
                "keyRaw": "deleteUser(id: \"1234\")",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "userID": {
                            "type": "ID",
                            "keyRaw": "userID",
                            "nullable": true,

                            "directives": [{
                                "name": "User_delete",
                                "arguments": {}
                            }],


                            "operations": [{
                                "action": "delete",
                                "type": "User"
                            }],
                            "visible": true,
                        },
                    },
                },

                "visible": true,
            },
        },
    },

    "pluginData": {},
} as const

export default artifact

export type A = {
	readonly "input"?: A$input;
	readonly "result": A$result;
};

export type A$result = {
	readonly deleteUser: {
		readonly userID: string | null;
	};
};

export type A$input = null | undefined;

export type A$optimistic = {
	readonly deleteUser?: {
		readonly userID?: string | null;
	};
};

export type A$unmasked = {
	readonly deleteUser: {
		readonly __typename: "DeleteUserOutput";
		readonly userID: string | null;
	};
};

export type A$artifact = typeof artifact

"HoudiniHash=74a70a5832df8760e9a80f1b32360a58e5c6ecd48551606448ce2cd6bbae28c2"`),
				},
			},
			{
				Name: "delete operation with condition",
				Pass: true,
				Input: []string{
					`mutation A {
              deleteUser(id: "1234") {
                userID @User_delete @when(stringValue:"foo")
              }
            }`,
					`query TestQuery {
              users @list(name: "All_Users") {
                firstName
              }
            }`,
				},
				Extra: map[string]any{
					"A": tests.Dedent(`const artifact = {
    "name": "A",
    "kind": "HoudiniMutation",
    "hash": "74a70a5832df8760e9a80f1b32360a58e5c6ecd48551606448ce2cd6bbae28c2",
    "raw": ` + "`" + `mutation A {
    deleteUser(id: "1234") {
        userID
        __typename
    }
}
` + "`" + `,

    "rootType": "Mutation",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "deleteUser": {
                "type": "DeleteUserOutput",
                "keyRaw": "deleteUser(id: \"1234\")",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "userID": {
                            "type": "ID",
                            "keyRaw": "userID",
                            "nullable": true,

                            "directives": [{
                                "name": "User_delete",
                                "arguments": {}
                            },{
                                "name": "when",
                                "arguments": {
                                    "stringValue": {
                                        "kind": "StringValue",
                                        "value": "foo"
                                    }
                                }
                            }],


                            "operations": [{
                                "action": "delete",
                                "type": "User",

                                "when": {
                                    "must": {
                                        "stringValue": {
                                            "kind": "String",
                                            "value": "foo"
                                        },
                                    },
                                },
                            }],
                            "visible": true,
                        },
                    },
                },

                "visible": true,
            },
        },
    },

    "pluginData": {},
} as const

export default artifact

export type A = {
	readonly "input"?: A$input;
	readonly "result": A$result;
};

export type A$result = {
	readonly deleteUser: {
		readonly userID: string | null;
	};
};

export type A$input = null | undefined;

export type A$optimistic = {
	readonly deleteUser?: {
		readonly userID?: string | null;
	};
};

export type A$unmasked = {
	readonly deleteUser: {
		readonly __typename: "DeleteUserOutput";
		readonly userID: string | null;
	};
};

export type A$artifact = typeof artifact

"HoudiniHash=74a70a5832df8760e9a80f1b32360a58e5c6ecd48551606448ce2cd6bbae28c2"`),
				},
			},
			{
				Name: "must_not directive",
				Pass: true,
				Input: []string{
					`mutation A {
              deleteUser(id: "1234") {
                userID @User_delete @when_not(stringValue:"foo")
              }
            }`,
					`query TestQuery {
              users @list(name: "All_Users") {
                firstName
              }
            }`,
				},
				Extra: map[string]any{
					"A": tests.Dedent(`const artifact = {
    "name": "A",
    "kind": "HoudiniMutation",
    "hash": "74a70a5832df8760e9a80f1b32360a58e5c6ecd48551606448ce2cd6bbae28c2",
    "raw": ` + "`" + `mutation A {
    deleteUser(id: "1234") {
        userID
        __typename
    }
}
` + "`" + `,

    "rootType": "Mutation",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "deleteUser": {
                "type": "DeleteUserOutput",
                "keyRaw": "deleteUser(id: \"1234\")",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "userID": {
                            "type": "ID",
                            "keyRaw": "userID",
                            "nullable": true,

                            "directives": [{
                                "name": "User_delete",
                                "arguments": {}
                            },{
                                "name": "when_not",
                                "arguments": {
                                    "stringValue": {
                                        "kind": "StringValue",
                                        "value": "foo"
                                    }
                                }
                            }],


                            "operations": [{
                                "action": "delete",
                                "type": "User",

                                "when": {
                                    "must_not": {
                                        "stringValue": {
                                            "kind": "String",
                                            "value": "foo"
                                        },
                                    },
                                },
                            }],
                            "visible": true,
                        },
                    },
                },

                "visible": true,
            },
        },
    },

    "pluginData": {},
} as const

export default artifact

export type A = {
	readonly "input"?: A$input;
	readonly "result": A$result;
};

export type A$result = {
	readonly deleteUser: {
		readonly userID: string | null;
	};
};

export type A$input = null | undefined;

export type A$optimistic = {
	readonly deleteUser?: {
		readonly userID?: string | null;
	};
};

export type A$unmasked = {
	readonly deleteUser: {
		readonly __typename: "DeleteUserOutput";
		readonly userID: string | null;
	};
};

export type A$artifact = typeof artifact

"HoudiniHash=74a70a5832df8760e9a80f1b32360a58e5c6ecd48551606448ce2cd6bbae28c2"`),
				},
			},
			{
				Name: "parentID value",
				Pass: true,
				Input: []string{
					`mutation A {
              addFriend {
                friend {
                    ...All_Users_insert @parentID(value:"1234")
                }
              }
            }`,
					`query TestQuery {
              users @list(name: "All_Users") {
                firstName
              }
            }`,
				},
				Extra: map[string]any{
					"A": tests.Dedent(`const artifact = {
    "name": "A",
    "kind": "HoudiniMutation",
    "hash": "425691bbfea3900b92488e1ab1c9d6ee50242cadb1de2336342766d9577656f1",
    "raw": ` + "`" + `mutation A {
    addFriend {
        friend {
            ...All_Users_insert
            __typename
            id
        }
        __typename
    }
}

fragment All_Users_insert on User {
    firstName
    __typename
    id
}
` + "`" + `,

    "rootType": "Mutation",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "addFriend": {
                "type": "AddFriendOutput",
                "keyRaw": "addFriend",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "friend": {
                            "type": "User",
                            "keyRaw": "friend",

                            "operations": [{
                                "action": "insert",
                                "list": "All_Users",
                                "position": "last",

                                "parentID": {
                                    "kind": "StringValue",
                                    "value": "1234"
                                }
                            }],

                            "selection": {
                                "fields": {
                                    "__typename": {
                                        "type": "String",
                                        "keyRaw": "__typename",
                                    },

                                    "firstName": {
                                        "type": "String",
                                        "keyRaw": "firstName",
                                    },

                                    "id": {
                                        "type": "ID",
                                        "keyRaw": "id",
                                    },
                                },

                                "fragments": {
                                    "All_Users_insert": {
                                        "arguments": {}
                                    },
                                },
                            },

                            "visible": true,
                        },
                    },
                },

                "visible": true,
            },
        },
    },

    "pluginData": {},
} as const

export default artifact

export type A = {
	readonly "input"?: A$input;
	readonly "result": A$result;
};

export type A$result = {
	readonly addFriend: {
		readonly friend: {
			readonly " $fragments": {
				All_Users_insert: {};
			};
		};
	};
};

export type A$input = null | undefined;

export type A$optimistic = {
	readonly addFriend?: {
		readonly friend?: {
			readonly firstName?: string;
		};
	};
};

export type A$unmasked = {
	readonly addFriend: {
		readonly __typename: "AddFriendOutput";
		readonly friend: {
			readonly __typename: "User";
			readonly firstName: string;
			readonly id: string;
		};
	};
};

export type A$artifact = typeof artifact

"HoudiniHash=425691bbfea3900b92488e1ab1c9d6ee50242cadb1de2336342766d9577656f1"`),
				},
			},
			{
				Name: "Refetch operation",
				Pass: true,
				Input: []string{
					`mutation RefetchFriend {
              addFriend {
                friend @refetch {
                  firstName
                }
              }
            }`,
				},
				Extra: map[string]any{
					"RefetchFriend": tests.Dedent(`const artifact = {
    "name": "RefetchFriend",
    "kind": "HoudiniMutation",
    "hash": "f21fe997186bd64751f7dd8e9ef3d9329716175a963e5004be685010e2e4c9c0",
    "raw": ` + "`" + `mutation RefetchFriend {
    addFriend {
        friend {
            firstName
            __typename
            id
        }
        __typename
    }
}
` + "`" + `,

    "rootType": "Mutation",
    "stripVariables": [] as Array<string>,

    "selection": {
        "fields": {
            "addFriend": {
                "type": "AddFriendOutput",
                "keyRaw": "addFriend",

                "selection": {
                    "fields": {
                        "__typename": {
                            "type": "String",
                            "keyRaw": "__typename",
                        },

                        "friend": {
                            "type": "User",
                            "keyRaw": "friend",

                            "directives": [{
                                "name": "refetch",
                                "arguments": {}
                            }],


                            "selection": {
                                "fields": {
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

                            "visible": true,
                        },
                    },
                },

                "visible": true,
            },
        },
    },

    "operations": [{
        "action": "refetch",
        "type": "User",
        "path": ["addFriend","friend"]
    }],

    "pluginData": {},
} as const

export default artifact

export type RefetchFriend = {
	readonly "input"?: RefetchFriend$input;
	readonly "result": RefetchFriend$result;
};

export type RefetchFriend$result = {
	readonly addFriend: {
		readonly friend: {
			readonly firstName: string;
		};
	};
};

export type RefetchFriend$input = null | undefined;

export type RefetchFriend$optimistic = {
	readonly addFriend?: {
		readonly friend?: {
			readonly firstName?: string;
		};
	};
};

export type RefetchFriend$unmasked = {
	readonly addFriend: {
		readonly __typename: "AddFriendOutput";
		readonly friend: {
			readonly __typename: "User";
			readonly firstName: string;
			readonly id: string;
		};
	};
};

export type RefetchFriend$artifact = typeof artifact

"HoudiniHash=f21fe997186bd64751f7dd8e9ef3d9329716175a963e5004be685010e2e4c9c0"`),
				},
			},
		},
	})
}
