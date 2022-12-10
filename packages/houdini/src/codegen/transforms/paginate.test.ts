import { test, expect } from 'vitest'

import { runPipeline } from '../../codegen'
import { mockCollectedDoc, testConfig } from '../../test'

test('adds pagination info to full', async function () {
	const docs = [
		mockCollectedDoc(
			`
                fragment UserFriends on Query {
                    usersByCursor(first: 10) @paginate {
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

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0].document).toMatchInlineSnapshot(`
		fragment UserFriends on Query @arguments(first: {type: "Int", default: 10}, after: {type: "String"}) {
		  usersByCursor(first: $first, after: $after) @paginate {
		    edges {
		      node {
		        id
		        __typename
		      }
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
	`)

	expect(docs[0].refetch).toMatchInlineSnapshot(`
		{
		    "update": "append",
		    "path": [
		        "usersByCursor"
		    ],
		    "method": "cursor",
		    "pageSize": 10,
		    "embedded": false,
		    "targetType": "Query",
		    "paginated": true,
		    "direction": "forward"
		}
	`)
})

test('paginated fragments on node pull data from one field deeper', async function () {
	const docs = [
		mockCollectedDoc(
			`
                fragment UserFriends on User {
					friendsByCursor(first: 10) @paginate {
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

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	expect(docs[0].refetch).toMatchInlineSnapshot(`
		{
		    "update": "append",
		    "path": [
		        "friendsByCursor"
		    ],
		    "method": "cursor",
		    "pageSize": 10,
		    "embedded": true,
		    "targetType": "Node",
		    "paginated": true,
		    "direction": "forward"
		}
	`)
})

test("doesn't add pagination info to offset pagination", async function () {
	const docs = [
		mockCollectedDoc(
			`
                fragment UserFriends on Query {
                    usersByOffset(limit: 10) @paginate {
						id
                    }
                }
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0].document).toMatchInlineSnapshot(`
		fragment UserFriends on Query @arguments(limit: {type: "Int", default: 10}, offset: {type: "Int"}) {
		  usersByOffset(limit: $limit, offset: $offset) @paginate {
		    id
		  }
		}

	`)
})

test('paginate adds forwards cursor args to the full cursor fragment', async function () {
	const docs = [
		mockCollectedDoc(
			`
                fragment UserFriends on Query {
                    usersByCursor(first: 10) @paginate {
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

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0].document).toMatchInlineSnapshot(`
		fragment UserFriends on Query @arguments(first: {type: "Int", default: 10}, after: {type: "String"}) {
		  usersByCursor(first: $first, after: $after) @paginate {
		    edges {
		      node {
		        id
		        __typename
		      }
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
	`)
})

test('paginate adds backwards cursor args to the full cursor fragment', async function () {
	const docs = [
		mockCollectedDoc(
			`
                fragment UserFriends on Query {
                    usersByCursor(last: 10) @paginate {
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

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0].document).toMatchInlineSnapshot(`
		fragment UserFriends on Query @arguments(last: {type: "Int", default: 10}, before: {type: "String"}) {
		  usersByCursor(last: $last, before: $before) @paginate {
		    edges {
		      node {
		        id
		        __typename
		      }
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
	`)
})

test('paginate adds forwards cursor args to the fragment', async function () {
	const docs = [
		mockCollectedDoc(
			`
                fragment UserFriends on Query {
                    usersByForwardsCursor(first: 10) @paginate {
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

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0].document).toMatchInlineSnapshot(`
		fragment UserFriends on Query @arguments(first: {type: "Int", default: 10}, after: {type: "String"}) {
		  usersByForwardsCursor(first: $first, after: $after) @paginate {
		    edges {
		      node {
		        id
		        __typename
		      }
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
	`)
})

test('paginate adds backwards cursor args to the fragment', async function () {
	const docs = [
		mockCollectedDoc(
			`
                fragment UserFriends on Query {
                    usersByBackwardsCursor(last: 10) @paginate {
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

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0].document).toMatchInlineSnapshot(`
		fragment UserFriends on Query @arguments(last: {type: "Int", default: 10}, before: {type: "String"}) {
		  usersByBackwardsCursor(last: $last, before: $before) @paginate {
		    edges {
		      node {
		        id
		        __typename
		      }
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
	`)
})

test('sets before with default value', async function () {
	const docs = [
		mockCollectedDoc(
			`
                fragment UserFriends on Query {
                    usersByCursor(last: 10, before: "cursor") @paginate {
                        edges {
                            node {
                                id
                            }
                        }
                    }
                }
			`
		),
		// mockCollectedDoc('')
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0].document).toMatchInlineSnapshot(`
		fragment UserFriends on Query @arguments(last: {type: "Int", default: 10}, before: {type: "String", default: "cursor"}) {
		  usersByCursor(last: $last, before: $before) @paginate {
		    edges {
		      node {
		        id
		        __typename
		      }
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
	`)
})

test('embeds pagination query as a separate document', async function () {
	const docs = [
		mockCollectedDoc(
			`
                fragment UserFriends on Query {
                    usersByForwardsCursor(first: 10) @paginate {
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

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[1]?.document).toMatchInlineSnapshot(`
		query UserFriends_Pagination_Query($first: Int = 10, $after: String) {
		  ...UserFriends_jrGTj @with(first: $first, after: $after)
		}

		fragment UserFriends_jrGTj on Query @arguments(first: {type: "Int", default: 10}, after: {type: "String"}) {
		  usersByForwardsCursor(first: $first, after: $after) @paginate {
		    edges {
		      node {
		        id
		        __typename
		      }
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
	`)
})

test('embeds node pagination query as a separate document', async function () {
	const docs = [
		mockCollectedDoc(
			`
                fragment UserFriends on User {
                    friendsByForwardsCursor(first: 10) @paginate {
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

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	// load the contents of the file
	await expect(docs[1]).toMatchInlineSnapshot(`
		export default {
		    name: "UserFriends_Pagination_Query",
		    kind: "HoudiniQuery",
		    hash: "4ff3c0d7d0bc3f812896dd71dc3ff18e3066fe2459502a99fab163508be90b7a",

		    refetch: {
		        update: "append",
		        path: ["friendsByForwardsCursor"],
		        method: "cursor",
		        pageSize: 10,
		        embedded: true,
		        targetType: "Node",
		        paginated: true,
		        direction: "forward"
		    },

		    raw: \`query UserFriends_Pagination_Query($first: Int = 10, $after: String, $id: ID!) {
		  node(id: $id) {
		    __typename
		    id
		    ...UserFriends_jrGTj
		  }
		}

		fragment UserFriends_jrGTj on User {
		  friendsByForwardsCursor(first: $first, after: $after) {
		    edges {
		      node {
		        id
		        __typename
		      }
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

		    rootType: "Query",

		    selection: {
		        fields: {
		            node: {
		                type: "Node",
		                keyRaw: "node(id: $id)",
		                nullable: true,

		                selection: {
		                    abstractFields: {
		                        fields: {
		                            User: {
		                                friendsByForwardsCursor: {
		                                    type: "UserConnection",
		                                    keyRaw: "friendsByForwardsCursor::paginated",

		                                    selection: {
		                                        fields: {
		                                            edges: {
		                                                type: "UserEdge",
		                                                keyRaw: "edges",
		                                                update: "append",

		                                                selection: {
		                                                    fields: {
		                                                        node: {
		                                                            type: "User",
		                                                            keyRaw: "node",
		                                                            nullable: true,

		                                                            selection: {
		                                                                fields: {
		                                                                    id: {
		                                                                        type: "ID",
		                                                                        keyRaw: "id"
		                                                                    },

		                                                                    __typename: {
		                                                                        type: "String",
		                                                                        keyRaw: "__typename"
		                                                                    }
		                                                                }
		                                                            }
		                                                        },

		                                                        cursor: {
		                                                            type: "String",
		                                                            keyRaw: "cursor"
		                                                        }
		                                                    }
		                                                }
		                                            },

		                                            pageInfo: {
		                                                type: "PageInfo",
		                                                keyRaw: "pageInfo",

		                                                selection: {
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
		                                },

		                                __typename: {
		                                    type: "String",
		                                    keyRaw: "__typename"
		                                },

		                                id: {
		                                    type: "ID",
		                                    keyRaw: "id"
		                                }
		                            }
		                        },

		                        typeMap: {}
		                    },

		                    fields: {
		                        __typename: {
		                            type: "String",
		                            keyRaw: "__typename"
		                        },

		                        id: {
		                            type: "ID",
		                            keyRaw: "id"
		                        },

		                        friendsByForwardsCursor: {
		                            type: "UserConnection",
		                            keyRaw: "friendsByForwardsCursor::paginated",

		                            selection: {
		                                fields: {
		                                    edges: {
		                                        type: "UserEdge",
		                                        keyRaw: "edges",
		                                        update: "append",

		                                        selection: {
		                                            fields: {
		                                                node: {
		                                                    type: "User",
		                                                    keyRaw: "node",
		                                                    nullable: true,

		                                                    selection: {
		                                                        fields: {
		                                                            id: {
		                                                                type: "ID",
		                                                                keyRaw: "id"
		                                                            },

		                                                            __typename: {
		                                                                type: "String",
		                                                                keyRaw: "__typename"
		                                                            }
		                                                        }
		                                                    }
		                                                },

		                                                cursor: {
		                                                    type: "String",
		                                                    keyRaw: "cursor"
		                                                }
		                                            }
		                                        }
		                                    },

		                                    pageInfo: {
		                                        type: "PageInfo",
		                                        keyRaw: "pageInfo",

		                                        selection: {
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
		                        }
		                    }
		                },

		                abstract: true
		            }
		        }
		    },

		    input: {
		        fields: {
		            first: "Int",
		            after: "String",
		            id: "ID"
		        },

		        types: {}
		    },

		    policy: "CacheOrNetwork",
		    partial: false
		};

		"HoudiniHash=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
	`)
})

test('embeds custom pagination query as a separate document', async function () {
	const docs = [
		mockCollectedDoc(
			`
                fragment UserGhost on Ghost {
                    friendsConnection(first: 10) @paginate {
                        edges {
                            node {
								name
                            }
                        }
                    }
                }
			`
		),
	]

	// run the pipeline
	const config = testConfig({
		types: {
			Ghost: {
				keys: ['name', 'aka'],
				resolve: {
					queryField: 'ghost',
					arguments: (ghost) => ({
						name: ghost.name,
						aka: ghost.aka,
					}),
				},
			},
		},
	})
	await runPipeline(config, docs)

	// load the contents of the file
	await expect(docs[1]).toMatchInlineSnapshot(`
		export default {
		    name: "UserGhost_Pagination_Query",
		    kind: "HoudiniQuery",
		    hash: "c5970407ebf288fcad596b8eacf0093c3992c8b16a5044e4f38317c8d73245aa",

		    refetch: {
		        update: "append",
		        path: ["friendsConnection"],
		        method: "cursor",
		        pageSize: 10,
		        embedded: true,
		        targetType: "Ghost",
		        paginated: true,
		        direction: "forward"
		    },

		    raw: \`query UserGhost_Pagination_Query($first: Int = 10, $after: String, $name: String!, $aka: String!) {
		  ghost(name: $name, aka: $aka) {
		    __typename
		    name
		    aka
		    ...UserGhost_jrGTj
		  }
		}

		fragment UserGhost_jrGTj on Ghost {
		  friendsConnection(first: $first, after: $after) {
		    edges {
		      node {
		        name
		        aka
		        __typename
		      }
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

		    rootType: "Query",

		    selection: {
		        fields: {
		            ghost: {
		                type: "Ghost",
		                keyRaw: "ghost(name: $name, aka: $aka)",

		                selection: {
		                    fields: {
		                        friendsConnection: {
		                            type: "GhostConnection",
		                            keyRaw: "friendsConnection::paginated",

		                            selection: {
		                                fields: {
		                                    edges: {
		                                        type: "GhostEdge",
		                                        keyRaw: "edges",
		                                        update: "append",

		                                        selection: {
		                                            fields: {
		                                                node: {
		                                                    type: "Ghost",
		                                                    keyRaw: "node",
		                                                    nullable: true,

		                                                    selection: {
		                                                        fields: {
		                                                            name: {
		                                                                type: "String",
		                                                                keyRaw: "name"
		                                                            },

		                                                            aka: {
		                                                                type: "String",
		                                                                keyRaw: "aka"
		                                                            },

		                                                            __typename: {
		                                                                type: "String",
		                                                                keyRaw: "__typename"
		                                                            }
		                                                        }
		                                                    }
		                                                },

		                                                cursor: {
		                                                    type: "String",
		                                                    keyRaw: "cursor"
		                                                }
		                                            }
		                                        }
		                                    },

		                                    pageInfo: {
		                                        type: "PageInfo",
		                                        keyRaw: "pageInfo",

		                                        selection: {
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
		                        },

		                        __typename: {
		                            type: "String",
		                            keyRaw: "__typename"
		                        },

		                        name: {
		                            type: "String",
		                            keyRaw: "name"
		                        },

		                        aka: {
		                            type: "String",
		                            keyRaw: "aka"
		                        }
		                    }
		                }
		            }
		        }
		    },

		    input: {
		        fields: {
		            first: "Int",
		            after: "String",
		            name: "String",
		            aka: "String"
		        },

		        types: {}
		    },

		    policy: "CacheOrNetwork",
		    partial: false
		};

		"HoudiniHash=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
	`)
})

test('query with forwards cursor paginate', async function () {
	const docs = [
		mockCollectedDoc(
			`
                query Users {
                    usersByForwardsCursor(first: 10) @paginate {
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

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0]?.document).toMatchInlineSnapshot(`
		query Users($first: Int = 10, $after: String) {
		  usersByForwardsCursor(first: $first, after: $after) @paginate {
		    edges {
		      node {
		        id
		        __typename
		      }
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
	`)
})

test('query with custom first args', async function () {
	const docs = [
		mockCollectedDoc(
			`
                query Users ($limit: Int!){
                    usersByForwardsCursor(first: $limit) @paginate {
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

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0]?.document).toMatchInlineSnapshot(`
		query Users($limit: Int!, $after: String) {
		  usersByForwardsCursor(first: $limit, after: $after) @paginate {
		    edges {
		      node {
		        id
		        __typename
		      }
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
	`)
})

test('query with backwards cursor paginate', async function () {
	const docs = [
		mockCollectedDoc(
			`
                query Users {
                    usersByBackwardsCursor(last: 10) @paginate {
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

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0]?.document).toMatchInlineSnapshot(`
		query Users($last: Int = 10, $before: String) {
		  usersByBackwardsCursor(last: $last, before: $before) @paginate {
		    edges {
		      node {
		        id
		        __typename
		      }
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
	`)
})

test('query with offset paginate', async function () {
	const docs = [
		mockCollectedDoc(
			`
                query Users {
                    usersByOffset(limit: 10) @paginate {
						id
                    }
                }
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0]?.document).toMatchInlineSnapshot(`
		query Users($limit: Int = 10, $offset: Int) {
		  usersByOffset(limit: $limit, offset: $offset) @paginate {
		    id
		  }
		}

	`)
})

test('query with backwards cursor on full paginate', async function () {
	const docs = [
		mockCollectedDoc(
			`
                query Users {
                    usersByCursor(last: 10) @paginate {
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

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0]?.document).toMatchInlineSnapshot(`
		query Users($last: Int = 10, $before: String) {
		  usersByCursor(last: $last, before: $before) @paginate {
		    edges {
		      node {
		        id
		        __typename
		      }
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
	`)
})

test('query with forwards cursor on full paginate', async function () {
	const docs = [
		mockCollectedDoc(
			`
                query Users {
                    usersByCursor(first: 10) @paginate {
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

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0]?.document).toMatchInlineSnapshot(`
		query Users($first: Int = 10, $after: String) {
		  usersByCursor(first: $first, after: $after) @paginate {
		    edges {
		      node {
		        id
		        __typename
		      }
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
	`)
})

test("forwards cursor paginated query doesn't overlap variables", async function () {
	const docs = [
		mockCollectedDoc(
			`
                query Users($first: Int!) {
                    usersByCursor(first: $first) @paginate {
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

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0]?.document).toMatchInlineSnapshot(`
		query Users($first: Int!, $after: String) {
		  usersByCursor(first: $first, after: $after) @paginate {
		    edges {
		      node {
		        id
		        __typename
		      }
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
	`)
})

test("backwards cursor paginated query doesn't overlap variables", async function () {
	const docs = [
		mockCollectedDoc(
			`
                query Users($last: Int!) {
                    usersByCursor(last: $last) @paginate {
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

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0]?.document).toMatchInlineSnapshot(`
		query Users($last: Int!, $before: String) {
		  usersByCursor(last: $last, before: $before) @paginate {
		    edges {
		      node {
		        id
		        __typename
		      }
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
	`)
})

test("offset paginated query doesn't overlap variables", async function () {
	const docs = [
		mockCollectedDoc(
			`
                query Users($limit: Int! = 10) {
                    usersByOffset(limit: $limit) @paginate {
						id
                    }
                }
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0]?.document).toMatchInlineSnapshot(`
		query Users($limit: Int! = 10, $offset: Int) {
		  usersByOffset(limit: $limit, offset: $offset) @paginate {
		    id
		  }
		}

	`)
})

test('refetch specification with backwards pagination', async function () {
	const docs = [
		mockCollectedDoc(
			`
                fragment UserFriends on Query {
					usersByCursor(last: 10) @paginate {
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

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	expect(docs[0].refetch).toMatchInlineSnapshot(`
		{
		    "update": "prepend",
		    "path": [
		        "usersByCursor"
		    ],
		    "method": "cursor",
		    "pageSize": 10,
		    "embedded": false,
		    "targetType": "Query",
		    "paginated": true,
		    "direction": "backwards"
		}
	`)
})

test('refetch entry with initial backwards', async function () {
	const docs = [
		mockCollectedDoc(
			`
                fragment UserFriends on Query {
					usersByCursor(last: 10, before: "1234") @paginate {
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

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	expect(docs[0].refetch).toMatchInlineSnapshot(`
		{
		    "update": "prepend",
		    "path": [
		        "usersByCursor"
		    ],
		    "method": "cursor",
		    "pageSize": 10,
		    "embedded": false,
		    "targetType": "Query",
		    "paginated": true,
		    "direction": "backwards",
		    "start": "1234"
		}
	`)
})

test('refetch entry with initial forwards', async function () {
	const docs = [
		mockCollectedDoc(
			`
                fragment UserFriends on Query {
					usersByCursor(first: 10, after: "1234") @paginate {
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

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	expect(docs[0].refetch).toMatchInlineSnapshot(`
		{
		    "update": "append",
		    "path": [
		        "usersByCursor"
		    ],
		    "method": "cursor",
		    "pageSize": 10,
		    "embedded": false,
		    "targetType": "Query",
		    "paginated": true,
		    "direction": "forward",
		    "start": "1234"
		}
	`)
})

test('generated query has same refetch spec', async function () {
	const docs = [
		mockCollectedDoc(
			`
                fragment UserFriends on Query {
					usersByCursor(first: 10, after: "1234") @paginate {
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

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	await expect(docs[1]).toMatchInlineSnapshot(`
		export default {
		    name: "UserFriends_Pagination_Query",
		    kind: "HoudiniQuery",
		    hash: "1e2bc755f493a5f3c58fdb284609136e7160f1f2365fe192c49f1ae95b3ef2ee",

		    refetch: {
		        update: "append",
		        path: ["usersByCursor"],
		        method: "cursor",
		        pageSize: 10,
		        embedded: false,
		        targetType: "Query",
		        paginated: true,
		        direction: "forward",
		        start: "1234"
		    },

		    raw: \`query UserFriends_Pagination_Query($first: Int = 10, $after: String = "1234") {
		  ...UserFriends_jrGTj
		}

		fragment UserFriends_jrGTj on Query {
		  usersByCursor(first: $first, after: $after) {
		    edges {
		      node {
		        id
		        __typename
		      }
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

		    rootType: "Query",

		    selection: {
		        fields: {
		            usersByCursor: {
		                type: "UserConnection",
		                keyRaw: "usersByCursor::paginated",

		                selection: {
		                    fields: {
		                        edges: {
		                            type: "UserEdge",
		                            keyRaw: "edges",
		                            update: "append",

		                            selection: {
		                                fields: {
		                                    node: {
		                                        type: "User",
		                                        keyRaw: "node",
		                                        nullable: true,

		                                        selection: {
		                                            fields: {
		                                                id: {
		                                                    type: "ID",
		                                                    keyRaw: "id"
		                                                },

		                                                __typename: {
		                                                    type: "String",
		                                                    keyRaw: "__typename"
		                                                }
		                                            }
		                                        }
		                                    },

		                                    cursor: {
		                                        type: "String",
		                                        keyRaw: "cursor"
		                                    }
		                                }
		                            }
		                        },

		                        pageInfo: {
		                            type: "PageInfo",
		                            keyRaw: "pageInfo",

		                            selection: {
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
		            }
		        }
		    },

		    input: {
		        fields: {
		            first: "Int",
		            after: "String"
		        },

		        types: {}
		    },

		    policy: "CacheOrNetwork",
		    partial: false
		};

		"HoudiniHash=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
	`)
})

test('refetch specification with offset pagination', async function () {
	const docs = [
		mockCollectedDoc(
			`
                fragment UserFriends on Query {
					usersByOffset(limit: 10) @paginate {
						id
                    }
                }
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	expect(docs[0].refetch).toMatchInlineSnapshot(`
		{
		    "update": "append",
		    "path": [
		        "usersByOffset"
		    ],
		    "method": "offset",
		    "pageSize": 10,
		    "embedded": false,
		    "targetType": "Query",
		    "paginated": true,
		    "direction": "forward"
		}
	`)
})

test('refetch specification with initial offset', async function () {
	const docs = [
		mockCollectedDoc(
			`
                fragment UserFriends on Query {
					usersByOffset(limit: 10, offset: 10) @paginate {
						id
                    }
                }
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	expect(docs[0].refetch).toMatchInlineSnapshot(`
		{
		    "update": "append",
		    "path": [
		        "usersByOffset"
		    ],
		    "method": "offset",
		    "pageSize": 10,
		    "embedded": false,
		    "targetType": "Query",
		    "paginated": true,
		    "direction": "forward",
		    "start": 10
		}
	`)
})
