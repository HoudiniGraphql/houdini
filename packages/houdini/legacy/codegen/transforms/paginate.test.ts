import { expect, test } from 'vitest'

import { mockCollectedDoc, testConfig } from '../../test'
import { runPipeline } from '../codegen'

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
		    "path": [
		        "friendsByCursor"
		    ],
		    "method": "cursor",
		    "pageSize": 10,
		    "embedded": true,
		    "targetType": "Node",
		    "paginated": true,
		    "direction": "both",
		    "mode": "Infinite"
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
		    "path": [
		        "usersByCursor"
		    ],
		    "method": "cursor",
		    "pageSize": 10,
		    "embedded": false,
		    "targetType": "Query",
		    "paginated": true,
		    "direction": "both",
		    "mode": "Infinite"
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
		    "path": [
		        "usersByCursor"
		    ],
		    "method": "cursor",
		    "pageSize": 10,
		    "embedded": false,
		    "targetType": "Query",
		    "paginated": true,
		    "direction": "both",
		    "start": "1234",
		    "mode": "Infinite"
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
		    "path": [
		        "usersByCursor"
		    ],
		    "method": "cursor",
		    "pageSize": 10,
		    "embedded": false,
		    "targetType": "Query",
		    "paginated": true,
		    "direction": "both",
		    "start": "1234",
		    "mode": "Infinite"
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
		    "name": "UserFriends_Pagination_Query",
		    "kind": "HoudiniQuery",
		    "hash": "2a0c29a23f1eb0305f973e2758cc6c353e091bbbdc3e6afadb5245f8c41c74e2",

		    "refetch": {
		        "path": ["usersByCursor"],
		        "method": "cursor",
		        "pageSize": 10,
		        "embedded": false,
		        "targetType": "Query",
		        "paginated": true,
		        "direction": "both",
		        "start": "1234",
		        "mode": "Infinite"
		    },

		    "raw": \`query UserFriends_Pagination_Query($first: Int = 10, $after: String = "1234", $last: Int, $before: String) {
		  ...UserFriends_2Bf0M6
		}

		fragment UserFriends_2Bf0M6 on Query {
		  usersByCursor(first: $first, after: $after, last: $last, before: $before) {
		    edges {
		      node {
		        id
		      }
		    }
		    edges {
		      cursor
		      node {
		        __typename
		        id
		      }
		    }
		    pageInfo {
		      hasPreviousPage
		      hasNextPage
		      startCursor
		      endCursor
		    }
		  }
		  __typename
		}
		\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "usersByCursor": {
		                "type": "UserConnection",
		                "keyRaw": "usersByCursor::paginated",

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

		            "__typename": {
		                "type": "String",
		                "keyRaw": "__typename",
		                "visible": true
		            }
		        },

		        "fragments": {
		            "UserFriends": {
		                "arguments": {
		                    "first": {
		                        "kind": "Variable",

		                        "name": {
		                            "kind": "Name",
		                            "value": "first"
		                        }
		                    },

		                    "after": {
		                        "kind": "Variable",

		                        "name": {
		                            "kind": "Name",
		                            "value": "after"
		                        }
		                    },

		                    "last": {
		                        "kind": "Variable",

		                        "name": {
		                            "kind": "Name",
		                            "value": "last"
		                        }
		                    },

		                    "before": {
		                        "kind": "Variable",

		                        "name": {
		                            "kind": "Name",
		                            "value": "before"
		                        }
		                    }
		                }
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
		            "first": 10,
		            "after": "1234"
		        },

		        "runtimeScalars": {}
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
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
		    "path": [
		        "usersByOffset"
		    ],
		    "method": "offset",
		    "pageSize": 10,
		    "embedded": false,
		    "targetType": "Query",
		    "paginated": true,
		    "direction": "forward",
		    "mode": "Infinite"
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
		    "path": [
		        "usersByOffset"
		    ],
		    "method": "offset",
		    "pageSize": 10,
		    "embedded": false,
		    "targetType": "Query",
		    "paginated": true,
		    "direction": "forward",
		    "start": 10,
		    "mode": "Infinite"
		}
	`)
})

test('default defaultPaginateMode to SinglePage', async function () {
	const docs = [
		mockCollectedDoc(
			`fragment UserFriends on Query {
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
	const config = testConfig({ defaultPaginateMode: 'SinglePage' })
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "UserFriends",
		    "kind": "HoudiniFragment",
		    "hash": "e9ab11c13cd1bdcdec10b643bf052d2def345ace9a9191fee3f1b0b200c20ca7",

		    "refetch": {
		        "path": ["usersByCursor"],
		        "method": "cursor",
		        "pageSize": 10,
		        "embedded": false,
		        "targetType": "Query",
		        "paginated": true,
		        "direction": "both",
		        "mode": "SinglePage"
		    },

		    "raw": \`fragment UserFriends on Query {
		  usersByCursor(first: $first, after: $after, last: $last, before: $before) {
		    edges {
		      node {
		        id
		      }
		    }
		    edges {
		      cursor
		      node {
		        __typename
		        id
		      }
		    }
		    pageInfo {
		      hasPreviousPage
		      hasNextPage
		      startCursor
		      endCursor
		    }
		  }
		  __typename
		}
		\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "usersByCursor": {
		                "type": "UserConnection",
		                "keyRaw": "usersByCursor(after: $after, before: $before, first: $first, last: $last)::paginated",

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

		"HoudiniHash=c0276291ccf0e89ecf3e2c0fd68314703c62c8dca06915e602f931297be94c3c";
	`)
})

const nodeSchema = `
interface Node {
	mySuperId: ID!
}

type Query {
	node(mySuperId: ID!): Node
	friends(first: Int, after: String, last: Int, before: String): UserConnection!
}

type UserConnection {
	edges: [UserEdge!]!
	pageInfo: PageInfo!
}

type UserEdge {
	node: User
	cursor: String!
}

type PageInfo {
	hasPreviousPage: Boolean!
	hasNextPage: Boolean!
	startCursor: String
	endCursor: String
}

type User implements Node {
	id: ID!
	mySuperId: ID!
	name: String!
	friends(first: Int, after: String, last: Int, before: String): UserConnection!
}
`

test('paginate with a wrong node interface should throw', async function () {
	const docs = [
		mockCollectedDoc(
			`fragment UserFriends on User {
				friends(first: 1) @paginate {
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
		schema: nodeSchema,
		logLevel: 'full',
	})

	try {
		await runPipeline(config, docs)
		expect('We should').toBe('never be here')
	} catch (error) {
		if (Array.isArray(error) && error[0] instanceof Error) {
			expect(error[0].message).toMatchInlineSnapshot(
				`
				"It looks like you are trying to use @paginate on a document that does not have a valid type resolver.
				If this is happening inside of a fragment, make sure that the fragment either implements the Node interface or you
				have defined a resolver entry for the fragment type.

				For more information, please visit these links:
				- https://houdinigraphql.com/guides/pagination#paginated-fragments
				- https://houdinigraphql.com/guides/caching-data#custom-ids
				"
			`
			)
		} else {
			expect('We should').toBe('never be here')
		}
	}
})
