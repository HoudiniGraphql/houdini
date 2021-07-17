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

					    refetch: {
					        update: "append",
					        source: ["node", "friendsByCursor"],
					        target: ["friendsByCursor"],
					        method: "cursor"
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
					        "friendsByCursor": {
					            "type": "UserConnection",
					            "keyRaw": "paginated::friendsByCursor(filter: \\"hello\\")",

					            "fields": {
					                "edges": {
					                    "type": "UserEdge",
					                    "keyRaw": "edges",

					                    "fields": {
					                        "node": {
					                            "type": "User",
					                            "keyRaw": "node",

					                            "fields": {
					                                "id": {
					                                    "type": "ID",
					                                    "keyRaw": "id"
					                                }
					                            }
					                        },

					                        "cursor": {
					                            "type": "String",
					                            "keyRaw": "cursor"
					                        }
					                    },

					                    "paginate": "append"
					                },

					                "pageInfo": {
					                    "type": "PageInfo",
					                    "keyRaw": "pageInfo",

					                    "fields": {
					                        "hasPreviousPage": {
					                            "type": "Boolean",
					                            "keyRaw": "hasPreviousPage"
					                        },

					                        "hasNextPage": {
					                            "type": "Boolean",
					                            "keyRaw": "hasNextPage"
					                        },

					                        "startCursor": {
					                            "type": "String",
					                            "keyRaw": "startCursor"
					                        },

					                        "endCursor": {
					                            "type": "String",
					                            "keyRaw": "endCursor"
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

					    refetch: {
					        update: "append",
					        source: ["node", "friendsByOffset"],
					        target: ["friendsByOffset"],
					        method: "offset"
					    },

					    raw: \`fragment PaginatedFragment on User {
					  friendsByOffset(limit: $limit, filter: "hello", offset: $offset) {
					    id
					  }
					}
					\`,

					    rootType: "User",

					    selection: {
					        "friendsByOffset": {
					            "type": "User",
					            "keyRaw": "paginated::friendsByOffset(filter: \\"hello\\")",

					            "fields": {
					                "id": {
					                    "type": "ID",
					                    "keyRaw": "id"
					                }
					            },

					            "paginate": "append"
					        }
					    }
					};
				`)
})

test('pagination arguments stripped from key', async function () {
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

					    refetch: {
					        update: "append",
					        source: ["node", "friendsByCursor"],
					        target: ["friendsByCursor"],
					        method: "cursor"
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
					        "friendsByCursor": {
					            "type": "UserConnection",
					            "keyRaw": "paginated::friendsByCursor(filter: \\"hello\\")",

					            "fields": {
					                "edges": {
					                    "type": "UserEdge",
					                    "keyRaw": "edges",

					                    "fields": {
					                        "node": {
					                            "type": "User",
					                            "keyRaw": "node",

					                            "fields": {
					                                "friendsByCursor": {
					                                    "type": "UserConnection",
					                                    "keyRaw": "friendsByCursor",

					                                    "fields": {
					                                        "edges": {
					                                            "type": "UserEdge",
					                                            "keyRaw": "edges",

					                                            "fields": {
					                                                "node": {
					                                                    "type": "User",
					                                                    "keyRaw": "node",

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
					                                },

					                                "id": {
					                                    "type": "ID",
					                                    "keyRaw": "id"
					                                }
					                            }
					                        },

					                        "cursor": {
					                            "type": "String",
					                            "keyRaw": "cursor"
					                        }
					                    },

					                    "paginate": "append"
					                },

					                "pageInfo": {
					                    "type": "PageInfo",
					                    "keyRaw": "pageInfo",

					                    "fields": {
					                        "hasPreviousPage": {
					                            "type": "Boolean",
					                            "keyRaw": "hasPreviousPage"
					                        },

					                        "hasNextPage": {
					                            "type": "Boolean",
					                            "keyRaw": "hasNextPage"
					                        },

					                        "startCursor": {
					                            "type": "String",
					                            "keyRaw": "startCursor"
					                        },

					                        "endCursor": {
					                            "type": "String",
					                            "keyRaw": "endCursor"
					                        }
					                    }
					                }
					            }
					        }
					    }
					};
				`)
})
