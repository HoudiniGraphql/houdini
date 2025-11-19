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
                                        "visible": true,
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
			readonly All_Users_insert?:  | null;
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
    "hash": "5c4e7db84da4cc870dab20430a5f4a1895573dbbbd3f7568caee055770ad0370",
    "raw": ` + "`" + `mutation A() {
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
                                        "visible": true,
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
			readonly All_Users_insert_kVR6H?:  | null;
		};
	};
};

export type A$artifact = typeof artifact

"HoudiniHash=5c4e7db84da4cc870dab20430a5f4a1895573dbbbd3f7568caee055770ad0370"`),
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
                                        "stringValue": "foo",
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
                                        "visible": true,
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
			readonly All_Users_insert?:  | null;
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
                                        "stringValue": "foo",
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
                                        "visible": true,
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
			readonly All_Users_insert?:  | null;
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
                                        "stringValue": "foo",
                                    },
                                    "must_not": {
                                        "a": "foo",
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
                                        "visible": true,
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
			readonly All_Users_insert?:  | null;
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
    "hash": "5c4e7db84da4cc870dab20430a5f4a1895573dbbbd3f7568caee055770ad0370",
    "raw": ` + "`" + `mutation A() {
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
                                        "visible": true,
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
			readonly All_Users_insert_kVR6H?:  | null;
		};
	};
};

export type A$artifact = typeof artifact

"HoudiniHash=5c4e7db84da4cc870dab20430a5f4a1895573dbbbd3f7568caee055770ad0370"`),
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
		readonly friend?: {
			readonly id?: string;
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
                                        "visible": true,
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
			readonly All_Users_insert?:  | null;
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
		readonly friend?: {
			readonly All_Users_remove?:  | null;
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
                                        "visible": true,
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
			readonly All_Users_toggle?:  | null;
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
    "hash": "14c8b84f85cf39c1e786506a09bbeaa617139aa22c6723b595eaf0b7b29ca441",
    "raw": ` + "`" + `mutation A() {
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
                                        "visible": true,
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
			readonly All_Users_toggle_kVR6H?:  | null;
		};
	};
};

export type A$artifact = typeof artifact

"HoudiniHash=14c8b84f85cf39c1e786506a09bbeaa617139aa22c6723b595eaf0b7b29ca441"`),
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
                                        "visible": true,
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
			readonly All_Users_toggle?:  | null;
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
                                        "visible": true,
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
			readonly All_Users_toggle?:  | null;
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
		readonly friend?: {
			readonly All_Users_remove?:  | null;
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
                                        "stringValue": "foo",
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
                                        "stringValue": "foo",
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
                                        "visible": true,
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
			readonly All_Users_insert?:  | null;
		};
	};
};

export type A$artifact = typeof artifact

"HoudiniHash=425691bbfea3900b92488e1ab1c9d6ee50242cadb1de2336342766d9577656f1"`),
				},
			},
		},
	})
}
