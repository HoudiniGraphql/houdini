import { test, expect } from 'vitest'

import { runPipeline } from '../../..'
import { testConfig, mockCollectedDoc } from '../../../../test'

// the config to use in tests
const config = testConfig()

test('pagination arguments stripped from key', async function () {
	const docs = [
		mockCollectedDoc(
			`
            fragment PaginatedFragment on User {
                friendsByCursor(first:10, filter: "hello") @paginate {
                    edges {
                        node {
                            id
                        }
                    }
                }
            }
        `
		),
	]

	await runPipeline(config, docs)

	// look at the artifact for the generated pagination query
	await expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "PaginatedFragment",
		    "kind": "HoudiniFragment",
		    "hash": "ed9498ccbdc4d5a35b7fb6d1280ee254731c880e2484b4b34f8c462fb34c7985",

		    "refetch": {
		        "path": ["friendsByCursor"],
		        "method": "cursor",
		        "pageSize": 10,
		        "embedded": true,
		        "targetType": "Node",
		        "paginated": true,
		        "direction": "both",
		        "mode": "Infinite"
		    },

		    "raw": \`fragment PaginatedFragment on User {
		  friendsByCursor(
		    first: $first
		    filter: "hello"
		    after: $after
		    last: $last
		    before: $before
		  ) {
		    edges {
		      node {
		        id
		      }
		    }
		    pageInfo {
		      hasPreviousPage
		      hasNextPage
		      startCursor
		      endCursor
		    }
		    edges {
		      cursor
		      node {
		        __typename
		      }
		    }
		    pageInfo {
		      hasPreviousPage
		      hasNextPage
		      startCursor
		      endCursor
		    }
		  }
		  id
		  __typename
		}
		\`,

		    "rootType": "User",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "friendsByCursor": {
		                "type": "UserConnection",
		                "keyRaw": "friendsByCursor(filter: \\"hello\\")::paginated",

		                "directives": [{
		                    "name": "paginate",
		                    "arguments": {}
		                }],

		                "selection": {
		                    "fields": {
		                        "edges": {
		                            "type": "UserEdge",
		                            "keyRaw": "edges",
		                            "updates": ["append", "prepend"],

		                            "selection": {
		                                "fields": {
		                                    "node": {
		                                        "type": "User",
		                                        "keyRaw": "node",
		                                        "nullable": true,

		                                        "selection": {
		                                            "fields": {
		                                                "id": {
		                                                    "type": "ID",
		                                                    "keyRaw": "id",
		                                                    "visible": true
		                                                },

		                                                "__typename": {
		                                                    "type": "String",
		                                                    "keyRaw": "__typename",
		                                                    "visible": true
		                                                }
		                                            }
		                                        },

		                                        "visible": true
		                                    },

		                                    "cursor": {
		                                        "type": "String",
		                                        "keyRaw": "cursor",
		                                        "visible": true
		                                    }
		                                }
		                            },

		                            "visible": true
		                        },

		                        "pageInfo": {
		                            "type": "PageInfo",
		                            "keyRaw": "pageInfo",

		                            "selection": {
		                                "fields": {
		                                    "hasPreviousPage": {
		                                        "type": "Boolean",
		                                        "keyRaw": "hasPreviousPage",
		                                        "updates": ["append", "prepend"],
		                                        "visible": true
		                                    },

		                                    "hasNextPage": {
		                                        "type": "Boolean",
		                                        "keyRaw": "hasNextPage",
		                                        "updates": ["append", "prepend"],
		                                        "visible": true
		                                    },

		                                    "startCursor": {
		                                        "type": "String",
		                                        "keyRaw": "startCursor",
		                                        "updates": ["append", "prepend"],
		                                        "visible": true
		                                    },

		                                    "endCursor": {
		                                        "type": "String",
		                                        "keyRaw": "endCursor",
		                                        "updates": ["append", "prepend"],
		                                        "visible": true
		                                    }
		                                }
		                            },

		                            "visible": true
		                        }
		                    }
		                },

		                "visible": true
		            },

		            "id": {
		                "type": "ID",
		                "keyRaw": "id",
		                "visible": true
		            },

		            "__typename": {
		                "type": "String",
		                "keyRaw": "__typename",
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},

		    "input": {
		        "fields": {
		            "first": "Int",
		            "after": "String",
		            "last": "Int",
		            "before": "String"
		        },

		        "types": {},

		        "defaults": {
		            "first": 10
		        },

		        "runtimeScalars": {}
		    }
		};

		"HoudiniHash=2d5c4759a3afcc9c400670d48e718bd99a5063d53c50dab779f51455e5b2f566";
	`)
})

test('pagination arguments stays in key as it s a SinglePage Mode', async function () {
	const docs = [
		mockCollectedDoc(
			`
            fragment PaginatedFragment on User {
                friendsByCursor(first:10, filter: "hello") @paginate(mode: SinglePage) {
                    edges {
                        node {
                            id
                        }
                    }
                }
            }
        `
		),
	]

	await runPipeline(config, docs)

	// look at the artifact for the generated pagination query
	await expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "PaginatedFragment",
		    "kind": "HoudiniFragment",
		    "hash": "ed9498ccbdc4d5a35b7fb6d1280ee254731c880e2484b4b34f8c462fb34c7985",

		    "refetch": {
		        "path": ["friendsByCursor"],
		        "method": "cursor",
		        "pageSize": 10,
		        "embedded": true,
		        "targetType": "Node",
		        "paginated": true,
		        "direction": "both",
		        "mode": "SinglePage"
		    },

		    "raw": \`fragment PaginatedFragment on User {
		  friendsByCursor(
		    first: $first
		    filter: "hello"
		    after: $after
		    last: $last
		    before: $before
		  ) {
		    edges {
		      node {
		        id
		      }
		    }
		    pageInfo {
		      hasPreviousPage
		      hasNextPage
		      startCursor
		      endCursor
		    }
		    edges {
		      cursor
		      node {
		        __typename
		      }
		    }
		    pageInfo {
		      hasPreviousPage
		      hasNextPage
		      startCursor
		      endCursor
		    }
		  }
		  id
		  __typename
		}
		\`,

		    "rootType": "User",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "friendsByCursor": {
		                "type": "UserConnection",
		                "keyRaw": "friendsByCursor(after: $after, before: $before, filter: \\"hello\\", first: $first, last: $last)::paginated",

		                "directives": [{
		                    "name": "paginate",

		                    "arguments": {
		                        "mode": {
		                            "kind": "EnumValue",
		                            "value": "SinglePage"
		                        }
		                    }
		                }],

		                "selection": {
		                    "fields": {
		                        "edges": {
		                            "type": "UserEdge",
		                            "keyRaw": "edges",
		                            "updates": ["append", "prepend"],

		                            "selection": {
		                                "fields": {
		                                    "node": {
		                                        "type": "User",
		                                        "keyRaw": "node",
		                                        "nullable": true,

		                                        "selection": {
		                                            "fields": {
		                                                "id": {
		                                                    "type": "ID",
		                                                    "keyRaw": "id",
		                                                    "visible": true
		                                                },

		                                                "__typename": {
		                                                    "type": "String",
		                                                    "keyRaw": "__typename",
		                                                    "visible": true
		                                                }
		                                            }
		                                        },

		                                        "visible": true
		                                    },

		                                    "cursor": {
		                                        "type": "String",
		                                        "keyRaw": "cursor",
		                                        "visible": true
		                                    }
		                                }
		                            },

		                            "visible": true
		                        },

		                        "pageInfo": {
		                            "type": "PageInfo",
		                            "keyRaw": "pageInfo",

		                            "selection": {
		                                "fields": {
		                                    "hasPreviousPage": {
		                                        "type": "Boolean",
		                                        "keyRaw": "hasPreviousPage",
		                                        "updates": ["append", "prepend"],
		                                        "visible": true
		                                    },

		                                    "hasNextPage": {
		                                        "type": "Boolean",
		                                        "keyRaw": "hasNextPage",
		                                        "updates": ["append", "prepend"],
		                                        "visible": true
		                                    },

		                                    "startCursor": {
		                                        "type": "String",
		                                        "keyRaw": "startCursor",
		                                        "updates": ["append", "prepend"],
		                                        "visible": true
		                                    },

		                                    "endCursor": {
		                                        "type": "String",
		                                        "keyRaw": "endCursor",
		                                        "updates": ["append", "prepend"],
		                                        "visible": true
		                                    }
		                                }
		                            },

		                            "visible": true
		                        }
		                    }
		                },

		                "visible": true
		            },

		            "id": {
		                "type": "ID",
		                "keyRaw": "id",
		                "visible": true
		            },

		            "__typename": {
		                "type": "String",
		                "keyRaw": "__typename",
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},

		    "input": {
		        "fields": {
		            "first": "Int",
		            "after": "String",
		            "last": "Int",
		            "before": "String"
		        },

		        "types": {},

		        "defaults": {
		            "first": 10
		        },

		        "runtimeScalars": {}
		    }
		};

		"HoudiniHash=e826a62f4d540f02ed7358a9516e439e05b316a7e0035343fc928f296aedf2ea";
	`)
})

test('offset based pagination marks appropriate field', async function () {
	const docs = [
		mockCollectedDoc(
			`
            fragment PaginatedFragment on User {
                friendsByOffset(limit:10, filter: "hello") @paginate {
					id
                }
            }
        `
		),
	]

	await runPipeline(config, docs)

	// look at the artifact for the generated pagination query
	await expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "PaginatedFragment",
		    "kind": "HoudiniFragment",
		    "hash": "8cad2e9b0ede72e9c7c19594289f9efba5340de90617b63231a57bbbfeef7fea",

		    "refetch": {
		        "path": ["friendsByOffset"],
		        "method": "offset",
		        "pageSize": 10,
		        "embedded": true,
		        "targetType": "Node",
		        "paginated": true,
		        "direction": "forward",
		        "mode": "Infinite"
		    },

		    "raw": \`fragment PaginatedFragment on User {
		  friendsByOffset(limit: $limit, filter: "hello", offset: $offset) {
		    id
		  }
		  id
		  __typename
		}
		\`,

		    "rootType": "User",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "friendsByOffset": {
		                "type": "User",
		                "keyRaw": "friendsByOffset(filter: \\"hello\\")::paginated",

		                "directives": [{
		                    "name": "paginate",
		                    "arguments": {}
		                }],

		                "updates": ["append"],

		                "selection": {
		                    "fields": {
		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id",
		                            "visible": true
		                        }
		                    }
		                },

		                "visible": true
		            },

		            "id": {
		                "type": "ID",
		                "keyRaw": "id",
		                "visible": true
		            },

		            "__typename": {
		                "type": "String",
		                "keyRaw": "__typename",
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},

		    "input": {
		        "fields": {
		            "limit": "Int",
		            "offset": "Int"
		        },

		        "types": {},

		        "defaults": {
		            "limit": 10
		        },

		        "runtimeScalars": {}
		    }
		};

		"HoudiniHash=80c97a259c558a65e1998f7e817c6e433b2c3b5d6cad4c2ae2803324fe8e5f58";
	`)
})

test('cursor as scalar gets the right pagination query argument types', async function () {
	const docs = [
		mockCollectedDoc(
			`
            query ScalarPagination {
				user {
					friendsByCursorScalar(first:10, filter: "hello") @paginate {
						edges {
							node {
								friendsByCursor {
									edges {
										node {
											id
										}
									}
								}
							}
                        }
                    }
                }
            }
        `
		),
	]

	await runPipeline(config, docs)

	// look at the artifact for the generated pagination query
	await expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "ScalarPagination",
		    "kind": "HoudiniQuery",
		    "hash": "bc8472e5f0b3987b33e8a9301e9d98033f6f8de399a96d73b5b5fbc35c3514a6",

		    "refetch": {
		        "path": ["user", "friendsByCursorScalar"],
		        "method": "cursor",
		        "pageSize": 10,
		        "embedded": false,
		        "targetType": "Query",
		        "paginated": true,
		        "direction": "both",
		        "mode": "Infinite"
		    },

		    "raw": \`query ScalarPagination($first: Int = 10, $after: Cursor, $last: Int, $before: Cursor) {
		  user {
		    friendsByCursorScalar(
		      first: $first
		      filter: "hello"
		      after: $after
		      last: $last
		      before: $before
		    ) {
		      edges {
		        node {
		          friendsByCursor {
		            edges {
		              node {
		                id
		              }
		            }
		          }
		          id
		        }
		      }
		      pageInfo {
		        hasPreviousPage
		        hasNextPage
		        startCursor
		        endCursor
		      }
		      edges {
		        cursor
		        node {
		          __typename
		        }
		      }
		      pageInfo {
		        hasPreviousPage
		        hasNextPage
		        startCursor
		        endCursor
		      }
		    }
		    id
		  }
		}
		\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "user": {
		                "type": "User",
		                "keyRaw": "user",

		                "selection": {
		                    "fields": {
		                        "friendsByCursorScalar": {
		                            "type": "UserConnection",
		                            "keyRaw": "friendsByCursorScalar(filter: \\"hello\\")::paginated",

		                            "directives": [{
		                                "name": "paginate",
		                                "arguments": {}
		                            }],

		                            "selection": {
		                                "fields": {
		                                    "edges": {
		                                        "type": "UserEdge",
		                                        "keyRaw": "edges",
		                                        "updates": ["append", "prepend"],

		                                        "selection": {
		                                            "fields": {
		                                                "node": {
		                                                    "type": "User",
		                                                    "keyRaw": "node",
		                                                    "nullable": true,

		                                                    "selection": {
		                                                        "fields": {
		                                                            "friendsByCursor": {
		                                                                "type": "UserConnection",
		                                                                "keyRaw": "friendsByCursor",

		                                                                "selection": {
		                                                                    "fields": {
		                                                                        "edges": {
		                                                                            "type": "UserEdge",
		                                                                            "keyRaw": "edges",

		                                                                            "selection": {
		                                                                                "fields": {
		                                                                                    "node": {
		                                                                                        "type": "User",
		                                                                                        "keyRaw": "node",
		                                                                                        "nullable": true,

		                                                                                        "selection": {
		                                                                                            "fields": {
		                                                                                                "id": {
		                                                                                                    "type": "ID",
		                                                                                                    "keyRaw": "id",
		                                                                                                    "visible": true
		                                                                                                }
		                                                                                            }
		                                                                                        },

		                                                                                        "visible": true
		                                                                                    }
		                                                                                }
		                                                                            },

		                                                                            "visible": true
		                                                                        }
		                                                                    }
		                                                                },

		                                                                "visible": true
		                                                            },

		                                                            "id": {
		                                                                "type": "ID",
		                                                                "keyRaw": "id",
		                                                                "visible": true
		                                                            },

		                                                            "__typename": {
		                                                                "type": "String",
		                                                                "keyRaw": "__typename",
		                                                                "visible": true
		                                                            }
		                                                        }
		                                                    },

		                                                    "visible": true
		                                                },

		                                                "cursor": {
		                                                    "type": "String",
		                                                    "keyRaw": "cursor",
		                                                    "visible": true
		                                                }
		                                            }
		                                        },

		                                        "visible": true
		                                    },

		                                    "pageInfo": {
		                                        "type": "PageInfo",
		                                        "keyRaw": "pageInfo",

		                                        "selection": {
		                                            "fields": {
		                                                "hasPreviousPage": {
		                                                    "type": "Boolean",
		                                                    "keyRaw": "hasPreviousPage",
		                                                    "updates": ["append", "prepend"],
		                                                    "visible": true
		                                                },

		                                                "hasNextPage": {
		                                                    "type": "Boolean",
		                                                    "keyRaw": "hasNextPage",
		                                                    "updates": ["append", "prepend"],
		                                                    "visible": true
		                                                },

		                                                "startCursor": {
		                                                    "type": "String",
		                                                    "keyRaw": "startCursor",
		                                                    "updates": ["append", "prepend"],
		                                                    "visible": true
		                                                },

		                                                "endCursor": {
		                                                    "type": "String",
		                                                    "keyRaw": "endCursor",
		                                                    "updates": ["append", "prepend"],
		                                                    "visible": true
		                                                }
		                                            }
		                                        },

		                                        "visible": true
		                                    }
		                                }
		                            },

		                            "visible": true
		                        },

		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id",
		                            "visible": true
		                        }
		                    }
		                },

		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},

		    "dedupe": {
		        "cancel": "last",
		        "match": "Variables"
		    },

		    "input": {
		        "fields": {
		            "first": "Int",
		            "after": "Cursor",
		            "last": "Int",
		            "before": "Cursor"
		        },

		        "types": {},

		        "defaults": {
		            "first": 10
		        },

		        "runtimeScalars": {}
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=9e2c500b01d31185266042250d637f928613b87afe976f04d02975d00b843a21";
	`)
})

test("sibling aliases don't get marked", async function () {
	const docs = [
		mockCollectedDoc(
			`
            fragment PaginatedFragment on User {
                friendsByCursor(first:10, filter: "hello") @paginate {
                    edges {
                        node {
							friendsByCursor {
								edges {
									node {
										id
									}
								}
							}
                        }
                    }
                }
                friends: friendsByCursor(first:10, filter: "hello") {
                    edges {
                        node {
							friendsByCursor {
								edges {
									node {
										id
									}
								}
							}
                        }
                    }
                }
            }
        `
		),
	]

	await runPipeline(config, docs)

	// look at the artifact for the generated pagination query
	await expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "PaginatedFragment",
		    "kind": "HoudiniFragment",
		    "hash": "4f933c65c6e551abd45d58d0136695d84e20e62b793f75cebb936091bfdfd2a5",

		    "refetch": {
		        "path": ["friendsByCursor"],
		        "method": "cursor",
		        "pageSize": 10,
		        "embedded": true,
		        "targetType": "Node",
		        "paginated": true,
		        "direction": "both",
		        "mode": "Infinite"
		    },

		    "raw": \`fragment PaginatedFragment on User {
		  friendsByCursor(
		    first: $first
		    filter: "hello"
		    after: $after
		    last: $last
		    before: $before
		  ) {
		    edges {
		      node {
		        friendsByCursor {
		          edges {
		            node {
		              id
		            }
		          }
		        }
		        id
		      }
		    }
		    pageInfo {
		      hasPreviousPage
		      hasNextPage
		      startCursor
		      endCursor
		    }
		    edges {
		      cursor
		      node {
		        __typename
		      }
		    }
		    pageInfo {
		      hasPreviousPage
		      hasNextPage
		      startCursor
		      endCursor
		    }
		  }
		  friends: friendsByCursor(first: 10, filter: "hello") {
		    edges {
		      node {
		        friendsByCursor {
		          edges {
		            node {
		              id
		            }
		          }
		        }
		        id
		      }
		    }
		  }
		  id
		  __typename
		}
		\`,

		    "rootType": "User",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "friendsByCursor": {
		                "type": "UserConnection",
		                "keyRaw": "friendsByCursor(filter: \\"hello\\")::paginated",

		                "directives": [{
		                    "name": "paginate",
		                    "arguments": {}
		                }],

		                "selection": {
		                    "fields": {
		                        "edges": {
		                            "type": "UserEdge",
		                            "keyRaw": "edges",
		                            "updates": ["append", "prepend"],

		                            "selection": {
		                                "fields": {
		                                    "node": {
		                                        "type": "User",
		                                        "keyRaw": "node",
		                                        "nullable": true,

		                                        "selection": {
		                                            "fields": {
		                                                "friendsByCursor": {
		                                                    "type": "UserConnection",
		                                                    "keyRaw": "friendsByCursor",

		                                                    "selection": {
		                                                        "fields": {
		                                                            "edges": {
		                                                                "type": "UserEdge",
		                                                                "keyRaw": "edges",

		                                                                "selection": {
		                                                                    "fields": {
		                                                                        "node": {
		                                                                            "type": "User",
		                                                                            "keyRaw": "node",
		                                                                            "nullable": true,

		                                                                            "selection": {
		                                                                                "fields": {
		                                                                                    "id": {
		                                                                                        "type": "ID",
		                                                                                        "keyRaw": "id",
		                                                                                        "visible": true
		                                                                                    }
		                                                                                }
		                                                                            },

		                                                                            "visible": true
		                                                                        }
		                                                                    }
		                                                                },

		                                                                "visible": true
		                                                            }
		                                                        }
		                                                    },

		                                                    "visible": true
		                                                },

		                                                "id": {
		                                                    "type": "ID",
		                                                    "keyRaw": "id",
		                                                    "visible": true
		                                                },

		                                                "__typename": {
		                                                    "type": "String",
		                                                    "keyRaw": "__typename",
		                                                    "visible": true
		                                                }
		                                            }
		                                        },

		                                        "visible": true
		                                    },

		                                    "cursor": {
		                                        "type": "String",
		                                        "keyRaw": "cursor",
		                                        "visible": true
		                                    }
		                                }
		                            },

		                            "visible": true
		                        },

		                        "pageInfo": {
		                            "type": "PageInfo",
		                            "keyRaw": "pageInfo",

		                            "selection": {
		                                "fields": {
		                                    "hasPreviousPage": {
		                                        "type": "Boolean",
		                                        "keyRaw": "hasPreviousPage",
		                                        "updates": ["append", "prepend"],
		                                        "visible": true
		                                    },

		                                    "hasNextPage": {
		                                        "type": "Boolean",
		                                        "keyRaw": "hasNextPage",
		                                        "updates": ["append", "prepend"],
		                                        "visible": true
		                                    },

		                                    "startCursor": {
		                                        "type": "String",
		                                        "keyRaw": "startCursor",
		                                        "updates": ["append", "prepend"],
		                                        "visible": true
		                                    },

		                                    "endCursor": {
		                                        "type": "String",
		                                        "keyRaw": "endCursor",
		                                        "updates": ["append", "prepend"],
		                                        "visible": true
		                                    }
		                                }
		                            },

		                            "visible": true
		                        }
		                    }
		                },

		                "visible": true
		            },

		            "friends": {
		                "type": "UserConnection",
		                "keyRaw": "friends(filter: \\"hello\\", first: 10)",

		                "selection": {
		                    "fields": {
		                        "edges": {
		                            "type": "UserEdge",
		                            "keyRaw": "edges",

		                            "selection": {
		                                "fields": {
		                                    "node": {
		                                        "type": "User",
		                                        "keyRaw": "node",
		                                        "nullable": true,

		                                        "selection": {
		                                            "fields": {
		                                                "friendsByCursor": {
		                                                    "type": "UserConnection",
		                                                    "keyRaw": "friendsByCursor",

		                                                    "selection": {
		                                                        "fields": {
		                                                            "edges": {
		                                                                "type": "UserEdge",
		                                                                "keyRaw": "edges",

		                                                                "selection": {
		                                                                    "fields": {
		                                                                        "node": {
		                                                                            "type": "User",
		                                                                            "keyRaw": "node",
		                                                                            "nullable": true,

		                                                                            "selection": {
		                                                                                "fields": {
		                                                                                    "id": {
		                                                                                        "type": "ID",
		                                                                                        "keyRaw": "id",
		                                                                                        "visible": true
		                                                                                    }
		                                                                                }
		                                                                            },

		                                                                            "visible": true
		                                                                        }
		                                                                    }
		                                                                },

		                                                                "visible": true
		                                                            }
		                                                        }
		                                                    },

		                                                    "visible": true
		                                                },

		                                                "id": {
		                                                    "type": "ID",
		                                                    "keyRaw": "id",
		                                                    "visible": true
		                                                }
		                                            }
		                                        },

		                                        "visible": true
		                                    }
		                                }
		                            },

		                            "visible": true
		                        }
		                    }
		                },

		                "visible": true
		            },

		            "id": {
		                "type": "ID",
		                "keyRaw": "id",
		                "visible": true
		            },

		            "__typename": {
		                "type": "String",
		                "keyRaw": "__typename",
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},

		    "input": {
		        "fields": {
		            "first": "Int",
		            "after": "String",
		            "last": "Int",
		            "before": "String"
		        },

		        "types": {},

		        "defaults": {
		            "first": 10
		        },

		        "runtimeScalars": {}
		    }
		};

		"HoudiniHash=7f9e237a0da97d7d704cde79d32f61fe252451fb96c89e19cb21e3f447d5e40d";
	`)
})
