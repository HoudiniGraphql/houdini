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
		    name: "PaginatedFragment",
		    kind: "HoudiniFragment",
		    hash: "45e5807e0714c312a701dce3a5156f70da61878dc419fb3f1e78914fca36d091",

		    refetch: {
		        update: "append",
		        path: ["friendsByCursor"],
		        method: "cursor",
		        pageSize: 10,
		        embedded: true,
		        targetType: "Node",
		        paginated: true,
		        direction: "forward"
		    },

		    raw: \`fragment PaginatedFragment on User {
		  friendsByCursor(first: $first, filter: "hello", after: $after) {
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
		}\`,

		    rootType: "User",

		    selection: {
		        friendsByCursor: {
		            type: "UserConnection",
		            keyRaw: "friendsByCursor(filter: \\"hello\\")::paginated",

		            fields: {
		                edges: {
		                    type: "UserEdge",
		                    keyRaw: "edges",

		                    fields: {
		                        cursor: {
		                            type: "String",
		                            keyRaw: "cursor"
		                        },

		                        node: {
		                            type: "User",
		                            keyRaw: "node",
		                            nullable: true,

		                            fields: {
		                                __typename: {
		                                    type: "String",
		                                    keyRaw: "__typename"
		                                },

		                                id: {
		                                    type: "ID",
		                                    keyRaw: "id"
		                                }
		                            }
		                        }
		                    },

		                    update: "append"
		                },

		                pageInfo: {
		                    type: "PageInfo",
		                    keyRaw: "pageInfo",

		                    fields: {
		                        hasPreviousPage: {
		                            type: "Boolean",
		                            keyRaw: "hasPreviousPage"
		                        },

		                        hasNextPage: {
		                            type: "Boolean",
		                            keyRaw: "hasNextPage"
		                        },

		                        startCursor: {
		                            type: "String",
		                            keyRaw: "startCursor"
		                        },

		                        endCursor: {
		                            type: "String",
		                            keyRaw: "endCursor"
		                        }
		                    }
		                }
		            }
		        }
		    }
		};

		"HoudiniHash=2d5c4759a3afcc9c400670d48e718bd99a5063d53c50dab779f51455e5b2f566";
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
		    name: "PaginatedFragment",
		    kind: "HoudiniFragment",
		    hash: "751f4becce0eaf199249b367d1badabaa9c1b8638bc2579dd546d968326c0b36",

		    refetch: {
		        update: "append",
		        path: ["friendsByOffset"],
		        method: "offset",
		        pageSize: 10,
		        embedded: true,
		        targetType: "Node",
		        paginated: true,
		        direction: "forward"
		    },

		    raw: \`fragment PaginatedFragment on User {
		  friendsByOffset(limit: $limit, filter: "hello", offset: $offset) {
		    id
		  }
		}\`,

		    rootType: "User",

		    selection: {
		        friendsByOffset: {
		            type: "User",
		            keyRaw: "friendsByOffset(filter: \\"hello\\")::paginated",
		            update: "append",

		            fields: {
		                id: {
		                    type: "ID",
		                    keyRaw: "id"
		                }
		            }
		        }
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
		    name: "ScalarPagination",
		    kind: "HoudiniQuery",
		    hash: "89f423f499065b03185c8b3f84fdec84dd0ddc1f26911a1bfa8550001b457623",

		    refetch: {
		        update: "append",
		        path: ["user", "friendsByCursorScalar"],
		        method: "cursor",
		        pageSize: 10,
		        embedded: false,
		        targetType: "Query",
		        paginated: true,
		        direction: "forward"
		    },

		    raw: \`query ScalarPagination($first: Int = 10, $after: Cursor) {
		  user {
		    friendsByCursorScalar(first: $first, filter: "hello", after: $after) {
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
		}\`,

		    rootType: "Query",

		    selection: {
		        user: {
		            type: "User",
		            keyRaw: "user",

		            fields: {
		                friendsByCursorScalar: {
		                    type: "UserConnection",
		                    keyRaw: "friendsByCursorScalar(filter: \\"hello\\")::paginated",

		                    fields: {
		                        edges: {
		                            type: "UserEdge",
		                            keyRaw: "edges",

		                            fields: {
		                                cursor: {
		                                    type: "String",
		                                    keyRaw: "cursor"
		                                },

		                                node: {
		                                    type: "User",
		                                    keyRaw: "node",
		                                    nullable: true,

		                                    fields: {
		                                        __typename: {
		                                            type: "String",
		                                            keyRaw: "__typename"
		                                        },

		                                        friendsByCursor: {
		                                            type: "UserConnection",
		                                            keyRaw: "friendsByCursor",

		                                            fields: {
		                                                edges: {
		                                                    type: "UserEdge",
		                                                    keyRaw: "edges",

		                                                    fields: {
		                                                        node: {
		                                                            type: "User",
		                                                            keyRaw: "node",
		                                                            nullable: true,

		                                                            fields: {
		                                                                id: {
		                                                                    type: "ID",
		                                                                    keyRaw: "id"
		                                                                }
		                                                            }
		                                                        }
		                                                    }
		                                                }
		                                            }
		                                        },

		                                        id: {
		                                            type: "ID",
		                                            keyRaw: "id"
		                                        }
		                                    }
		                                }
		                            },

		                            update: "append"
		                        },

		                        pageInfo: {
		                            type: "PageInfo",
		                            keyRaw: "pageInfo",

		                            fields: {
		                                hasPreviousPage: {
		                                    type: "Boolean",
		                                    keyRaw: "hasPreviousPage"
		                                },

		                                hasNextPage: {
		                                    type: "Boolean",
		                                    keyRaw: "hasNextPage"
		                                },

		                                startCursor: {
		                                    type: "String",
		                                    keyRaw: "startCursor"
		                                },

		                                endCursor: {
		                                    type: "String",
		                                    keyRaw: "endCursor"
		                                }
		                            }
		                        }
		                    }
		                },

		                id: {
		                    type: "ID",
		                    keyRaw: "id"
		                }
		            }
		        }
		    },

		    input: {
		        fields: {
		            first: "Int",
		            after: "Cursor"
		        },

		        types: {}
		    },

		    policy: "CacheOrNetwork",
		    partial: false
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
		    name: "PaginatedFragment",
		    kind: "HoudiniFragment",
		    hash: "04390d1e6cb284c67d7ee091adbecb9e4e72a82e73300dc663715f1c9a965455",

		    refetch: {
		        update: "append",
		        path: ["friendsByCursor"],
		        method: "cursor",
		        pageSize: 10,
		        embedded: true,
		        targetType: "Node",
		        paginated: true,
		        direction: "forward"
		    },

		    raw: \`fragment PaginatedFragment on User {
		  friendsByCursor(first: $first, filter: "hello", after: $after) {
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
		}\`,

		    rootType: "User",

		    selection: {
		        friendsByCursor: {
		            type: "UserConnection",
		            keyRaw: "friendsByCursor(filter: \\"hello\\")::paginated",

		            fields: {
		                edges: {
		                    type: "UserEdge",
		                    keyRaw: "edges",

		                    fields: {
		                        cursor: {
		                            type: "String",
		                            keyRaw: "cursor"
		                        },

		                        node: {
		                            type: "User",
		                            keyRaw: "node",
		                            nullable: true,

		                            fields: {
		                                __typename: {
		                                    type: "String",
		                                    keyRaw: "__typename"
		                                },

		                                friendsByCursor: {
		                                    type: "UserConnection",
		                                    keyRaw: "friendsByCursor",

		                                    fields: {
		                                        edges: {
		                                            type: "UserEdge",
		                                            keyRaw: "edges",

		                                            fields: {
		                                                node: {
		                                                    type: "User",
		                                                    keyRaw: "node",
		                                                    nullable: true,

		                                                    fields: {
		                                                        id: {
		                                                            type: "ID",
		                                                            keyRaw: "id"
		                                                        }
		                                                    }
		                                                }
		                                            }
		                                        }
		                                    }
		                                },

		                                id: {
		                                    type: "ID",
		                                    keyRaw: "id"
		                                }
		                            }
		                        }
		                    },

		                    update: "append"
		                },

		                pageInfo: {
		                    type: "PageInfo",
		                    keyRaw: "pageInfo",

		                    fields: {
		                        hasPreviousPage: {
		                            type: "Boolean",
		                            keyRaw: "hasPreviousPage"
		                        },

		                        hasNextPage: {
		                            type: "Boolean",
		                            keyRaw: "hasNextPage"
		                        },

		                        startCursor: {
		                            type: "String",
		                            keyRaw: "startCursor"
		                        },

		                        endCursor: {
		                            type: "String",
		                            keyRaw: "endCursor"
		                        }
		                    }
		                }
		            }
		        },

		        friends: {
		            type: "UserConnection",
		            keyRaw: "friends(first: 10, filter: \\"hello\\")",

		            fields: {
		                edges: {
		                    type: "UserEdge",
		                    keyRaw: "edges",

		                    fields: {
		                        node: {
		                            type: "User",
		                            keyRaw: "node",
		                            nullable: true,

		                            fields: {
		                                friendsByCursor: {
		                                    type: "UserConnection",
		                                    keyRaw: "friendsByCursor",

		                                    fields: {
		                                        edges: {
		                                            type: "UserEdge",
		                                            keyRaw: "edges",

		                                            fields: {
		                                                node: {
		                                                    type: "User",
		                                                    keyRaw: "node",
		                                                    nullable: true,

		                                                    fields: {
		                                                        id: {
		                                                            type: "ID",
		                                                            keyRaw: "id"
		                                                        }
		                                                    }
		                                                }
		                                            }
		                                        }
		                                    }
		                                },

		                                id: {
		                                    type: "ID",
		                                    keyRaw: "id"
		                                }
		                            }
		                        }
		                    }
		                }
		            }
		        }
		    }
		};

		"HoudiniHash=7f9e237a0da97d7d704cde79d32f61fe252451fb96c89e19cb21e3f447d5e40d";
	`)
})
