import { test, expect } from 'vitest'

import { runPipeline } from '../..'
import { testConfig, mockCollectedDoc } from '../../../test'

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
		    "hash": "6d33b4de899314bde6a0a75a1333ba3ea14c82df4de64de12e86bd700fa97840",

		    "refetch": {
		        "path": ["friendsByCursor"],
		        "method": "cursor",
		        "pageSize": 10,
		        "embedded": true,
		        "targetType": "Node",
		        "paginated": true,
		        "direction": "both"
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
		}
		\`,

		    "rootType": "User",

		    "selection": {
		        "fields": {
		            "friendsByCursor": {
		                "type": "UserConnection",
		                "keyRaw": "friendsByCursor(filter: \\"hello\\")::paginated",

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
		                                                    "keyRaw": "id"
		                                                },

		                                                "__typename": {
		                                                    "type": "String",
		                                                    "keyRaw": "__typename"
		                                                }
		                                            }
		                                        }
		                                    },

		                                    "cursor": {
		                                        "type": "String",
		                                        "keyRaw": "cursor"
		                                    }
		                                }
		                            }
		                        },

		                        "pageInfo": {
		                            "type": "PageInfo",
		                            "keyRaw": "pageInfo",

		                            "selection": {
		                                "fields": {
		                                    "hasPreviousPage": {
		                                        "type": "Boolean",
		                                        "keyRaw": "hasPreviousPage",
		                                        "updates": ["append", "prepend"]
		                                    },

		                                    "hasNextPage": {
		                                        "type": "Boolean",
		                                        "keyRaw": "hasNextPage",
		                                        "updates": ["append", "prepend"]
		                                    },

		                                    "startCursor": {
		                                        "type": "String",
		                                        "keyRaw": "startCursor",
		                                        "updates": ["append", "prepend"]
		                                    },

		                                    "endCursor": {
		                                        "type": "String",
		                                        "keyRaw": "endCursor",
		                                        "updates": ["append", "prepend"]
		                                    }
		                                }
		                            }
		                        }
		                    }
		                }
		            }
		        }
		    },

		    "input": {
		        "fields": {
		            "first": "Int",
		            "after": "String",
		            "last": "Int",
		            "before": "String"
		        },

		        "types": {}
		    }
		};

		"HoudiniHash=6d33b4de899314bde6a0a75a1333ba3ea14c82df4de64de12e86bd700fa97840";
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
		    "hash": "59e34c76e422b7fc1faf3d9c6b435eed873aad8b39a646b6cea17f5528cb8778",

		    "refetch": {
		        "path": ["friendsByOffset"],
		        "method": "offset",
		        "pageSize": 10,
		        "embedded": true,
		        "targetType": "Node",
		        "paginated": true,
		        "direction": "forward"
		    },

		    "raw": \`fragment PaginatedFragment on User {
		  friendsByOffset(limit: $limit, filter: "hello", offset: $offset) {
		    id
		  }
		}
		\`,

		    "rootType": "User",

		    "selection": {
		        "fields": {
		            "friendsByOffset": {
		                "type": "User",
		                "keyRaw": "friendsByOffset(filter: \\"hello\\")::paginated",
		                "updates": ["append"],

		                "selection": {
		                    "fields": {
		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id"
		                        }
		                    }
		                }
		            }
		        }
		    },

		    "input": {
		        "fields": {
		            "limit": "Int",
		            "offset": "Int"
		        },

		        "types": {}
		    }
		};

		"HoudiniHash=59e34c76e422b7fc1faf3d9c6b435eed873aad8b39a646b6cea17f5528cb8778";
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
		    "hash": "eaa29ae5e08599f31686c63642ccdaea5357883fd51e3417b72e2ec97265d9fd",

		    "refetch": {
		        "path": ["user", "friendsByCursorScalar"],
		        "method": "cursor",
		        "pageSize": 10,
		        "embedded": false,
		        "targetType": "Query",
		        "paginated": true,
		        "direction": "both"
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
		                                                                                                    "keyRaw": "id"
		                                                                                                }
		                                                                                            }
		                                                                                        }
		                                                                                    }
		                                                                                }
		                                                                            }
		                                                                        }
		                                                                    }
		                                                                }
		                                                            },

		                                                            "id": {
		                                                                "type": "ID",
		                                                                "keyRaw": "id"
		                                                            },

		                                                            "__typename": {
		                                                                "type": "String",
		                                                                "keyRaw": "__typename"
		                                                            }
		                                                        }
		                                                    }
		                                                },

		                                                "cursor": {
		                                                    "type": "String",
		                                                    "keyRaw": "cursor"
		                                                }
		                                            }
		                                        }
		                                    },

		                                    "pageInfo": {
		                                        "type": "PageInfo",
		                                        "keyRaw": "pageInfo",

		                                        "selection": {
		                                            "fields": {
		                                                "hasPreviousPage": {
		                                                    "type": "Boolean",
		                                                    "keyRaw": "hasPreviousPage",
		                                                    "updates": ["append", "prepend"]
		                                                },

		                                                "hasNextPage": {
		                                                    "type": "Boolean",
		                                                    "keyRaw": "hasNextPage",
		                                                    "updates": ["append", "prepend"]
		                                                },

		                                                "startCursor": {
		                                                    "type": "String",
		                                                    "keyRaw": "startCursor",
		                                                    "updates": ["append", "prepend"]
		                                                },

		                                                "endCursor": {
		                                                    "type": "String",
		                                                    "keyRaw": "endCursor",
		                                                    "updates": ["append", "prepend"]
		                                                }
		                                            }
		                                        }
		                                    }
		                                }
		                            }
		                        },

		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id"
		                        }
		                    }
		                }
		            }
		        }
		    },

		    "input": {
		        "fields": {
		            "first": "Int",
		            "after": "Cursor",
		            "last": "Int",
		            "before": "Cursor"
		        },

		        "types": {}
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=eaa29ae5e08599f31686c63642ccdaea5357883fd51e3417b72e2ec97265d9fd";
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
		    "hash": "712a00a1ed113743b06af410adbe9684e8b509049c6d11a67d6bc73cb0f1f15a",

		    "refetch": {
		        "path": ["friendsByCursor"],
		        "method": "cursor",
		        "pageSize": 10,
		        "embedded": true,
		        "targetType": "Node",
		        "paginated": true,
		        "direction": "both"
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
		}
		\`,

		    "rootType": "User",

		    "selection": {
		        "fields": {
		            "friendsByCursor": {
		                "type": "UserConnection",
		                "keyRaw": "friendsByCursor(filter: \\"hello\\")::paginated",

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
		                                                                                        "keyRaw": "id"
		                                                                                    }
		                                                                                }
		                                                                            }
		                                                                        }
		                                                                    }
		                                                                }
		                                                            }
		                                                        }
		                                                    }
		                                                },

		                                                "id": {
		                                                    "type": "ID",
		                                                    "keyRaw": "id"
		                                                },

		                                                "__typename": {
		                                                    "type": "String",
		                                                    "keyRaw": "__typename"
		                                                }
		                                            }
		                                        }
		                                    },

		                                    "cursor": {
		                                        "type": "String",
		                                        "keyRaw": "cursor"
		                                    }
		                                }
		                            }
		                        },

		                        "pageInfo": {
		                            "type": "PageInfo",
		                            "keyRaw": "pageInfo",

		                            "selection": {
		                                "fields": {
		                                    "hasPreviousPage": {
		                                        "type": "Boolean",
		                                        "keyRaw": "hasPreviousPage",
		                                        "updates": ["append", "prepend"]
		                                    },

		                                    "hasNextPage": {
		                                        "type": "Boolean",
		                                        "keyRaw": "hasNextPage",
		                                        "updates": ["append", "prepend"]
		                                    },

		                                    "startCursor": {
		                                        "type": "String",
		                                        "keyRaw": "startCursor",
		                                        "updates": ["append", "prepend"]
		                                    },

		                                    "endCursor": {
		                                        "type": "String",
		                                        "keyRaw": "endCursor",
		                                        "updates": ["append", "prepend"]
		                                    }
		                                }
		                            }
		                        }
		                    }
		                }
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
		                                                                                        "keyRaw": "id"
		                                                                                    }
		                                                                                }
		                                                                            }
		                                                                        }
		                                                                    }
		                                                                }
		                                                            }
		                                                        }
		                                                    }
		                                                },

		                                                "id": {
		                                                    "type": "ID",
		                                                    "keyRaw": "id"
		                                                }
		                                            }
		                                        }
		                                    }
		                                }
		                            }
		                        }
		                    }
		                }
		            }
		        }
		    },

		    "input": {
		        "fields": {
		            "first": "Int",
		            "after": "String",
		            "last": "Int",
		            "before": "String"
		        },

		        "types": {}
		    }
		};

		"HoudiniHash=712a00a1ed113743b06af410adbe9684e8b509049c6d11a67d6bc73cb0f1f15a";
	`)
})
