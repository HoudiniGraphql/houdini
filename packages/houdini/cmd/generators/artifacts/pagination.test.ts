// external imports
import { testConfig } from 'houdini-common'
// local imports
import '../../../../../jest.setup'
import { runPipeline } from '../../generate'
import { mockCollectedDoc } from '../../testUtils'

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
	await expect(docs[0]).toMatchArtifactSnapshot(`
					module.exports = {
					    name: "PaginatedFragment",
					    kind: "HoudiniFragment",
					    hash: "d655188329bfa82826d0e09c9b56fb90c276ed5b3b155784c3358db3cac30c87",

					    refetch: {
					        update: "append",
					        path: ["friendsByCursor"],
					        method: "cursor",
					        pageSize: 10,
					        embedded: true,
					        targetType: "Node"
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
					}
					\`,

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
	await expect(docs[0]).toMatchArtifactSnapshot(`
					module.exports = {
					    name: "PaginatedFragment",
					    kind: "HoudiniFragment",
					    hash: "61656f834b4f2afccdd42328b499f288fc9776befbef14154133565e0ac7e8b6",

					    refetch: {
					        update: "append",
					        path: ["friendsByOffset"],
					        method: "offset",
					        pageSize: 10,
					        embedded: true,
					        targetType: "Node"
					    },

					    raw: \`fragment PaginatedFragment on User {
					  friendsByOffset(limit: $limit, filter: "hello", offset: $offset) {
					    id
					  }
					}
					\`,

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
	await expect(docs[0]).toMatchArtifactSnapshot(`
					module.exports = {
					    name: "PaginatedFragment",
					    kind: "HoudiniFragment",
					    hash: "1a2d87a1d79e0241ab3ebda1cd43296a631d99973bb06e4fc66becd42c4a67be",

					    refetch: {
					        update: "append",
					        path: ["friendsByCursor"],
					        method: "cursor",
					        pageSize: 10,
					        embedded: true,
					        targetType: "Node"
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
					}
					\`,

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
				`)
})
