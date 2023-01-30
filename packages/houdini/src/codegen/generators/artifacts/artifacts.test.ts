import { test, expect, describe } from 'vitest'

import { runPipeline } from '../../../codegen'
import type { Document } from '../../../lib'
import { fs } from '../../../lib'
import { mockCollectedDoc, testConfig } from '../../../test'

// the config to use in tests
const config = testConfig()

test('generates an artifact for every document', async function () {
	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`query TestQuery { version }`),
		mockCollectedDoc(`fragment TestFragment on User { firstName }`),
	]

	// execute the generator
	await runPipeline(config, docs)

	// look up the files in the artifact directory
	const files = await fs.readdir(config.artifactDirectory)

	// and they have the right names
	expect(files).toEqual(expect.arrayContaining(['TestQuery.js', 'TestFragment.js']))
})

test('adds kind, name, and raw, response, and selection', async function () {
	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`query TestQuery { version }`),
		mockCollectedDoc(`fragment TestFragment on User { firstName }`),
	]

	// execute the generator
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestQuery",
		    "kind": "HoudiniQuery",
		    "hash": "8e483259f3d69f416c01b6106c0440fa0f916abb4cadb75273f8226a1ff0a5e2",

		    "raw": \`query TestQuery {
		  version
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "version": {
		                "type": "Int",
		                "keyRaw": "version"
		            }
		        }
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=8e483259f3d69f416c01b6106c0440fa0f916abb4cadb75273f8226a1ff0a5e2";
	`)

	expect(docs[1]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestFragment",
		    "kind": "HoudiniFragment",
		    "hash": "29c40b5d9f6b0cd77fc3fb46fc1338be4960369a01651d5149c2442a33b48686",

		    "raw": \`fragment TestFragment on User {
		  firstName
		}
		\`,

		    "rootType": "User",

		    "selection": {
		        "fields": {
		            "firstName": {
		                "type": "String",
		                "keyRaw": "firstName"
		            }
		        }
		    }
		};

		"HoudiniHash=29c40b5d9f6b0cd77fc3fb46fc1338be4960369a01651d5149c2442a33b48686";
	`)
})

test('selection includes fragments', async function () {
	// the documents to test
	const selectionDocs: Document[] = [
		mockCollectedDoc(`query TestQuery { user { ...TestFragment } }`),
		mockCollectedDoc(`fragment TestFragment on User { firstName }`),
	]

	// execute the generator
	await runPipeline(config, selectionDocs)

	// load the contents of the file
	expect(selectionDocs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestQuery",
		    "kind": "HoudiniQuery",
		    "hash": "044fab13113127071c8219ec4d31f8141844de8e106a7d05e38e0da37287cff8",

		    "raw": \`query TestQuery {
		  user {
		    ...TestFragment
		    id
		  }
		}

		fragment TestFragment on User {
		  firstName
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
		                        "firstName": {
		                            "type": "String",
		                            "keyRaw": "firstName"
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

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=044fab13113127071c8219ec4d31f8141844de8e106a7d05e38e0da37287cff8";
	`)

	expect(selectionDocs[1]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestFragment",
		    "kind": "HoudiniFragment",
		    "hash": "29c40b5d9f6b0cd77fc3fb46fc1338be4960369a01651d5149c2442a33b48686",

		    "raw": \`fragment TestFragment on User {
		  firstName
		}
		\`,

		    "rootType": "User",

		    "selection": {
		        "fields": {
		            "firstName": {
		                "type": "String",
		                "keyRaw": "firstName"
		            }
		        }
		    }
		};

		"HoudiniHash=29c40b5d9f6b0cd77fc3fb46fc1338be4960369a01651d5149c2442a33b48686";
	`)
})

test('internal directives are scrubbed', async function () {
	const docs = [
		mockCollectedDoc(`fragment A on User { firstName }`),
		mockCollectedDoc(`query TestQuery { user { ...A @prepend } }`),
	]

	// execute the generator
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[1]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestQuery",
		    "kind": "HoudiniQuery",
		    "hash": "2ca86ee49a5956fff859ec8e7d13ab04718c010b642d5990defeb8214a546fbc",

		    "raw": \`query TestQuery {
		  user {
		    ...A
		    id
		  }
		}

		fragment A on User {
		  firstName
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
		                        "firstName": {
		                            "type": "String",
		                            "keyRaw": "firstName"
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

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=2ca86ee49a5956fff859ec8e7d13ab04718c010b642d5990defeb8214a546fbc";
	`)
})

test('variables only used by internal directives are scrubbed', async function () {
	const docs = [
		mockCollectedDoc(`fragment A on User { firstName }`),
		mockCollectedDoc(
			`query TestQuery($parentID: ID!) {
				user {
					...A @prepend @parentID(value: $parentID)
				}
			}`
		),
	]

	// execute the generator
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[1]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestQuery",
		    "kind": "HoudiniQuery",
		    "hash": "bcf9dba98155557377232493c5ca1d412a8eee0e198db52162b48c4e20d666ad",

		    "raw": \`query TestQuery {
		  user {
		    ...A
		    id
		  }
		}

		fragment A on User {
		  firstName
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
		                        "firstName": {
		                            "type": "String",
		                            "keyRaw": "firstName"
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
		            "parentID": "ID"
		        },

		        "types": {}
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=bcf9dba98155557377232493c5ca1d412a8eee0e198db52162b48c4e20d666ad";
	`)
})

test('overlapping query and fragment selection', async function () {
	const docs = [
		mockCollectedDoc(`fragment A on User { firstName }`),
		mockCollectedDoc(`query TestQuery { user { firstName ...A @prepend } }`),
	]

	// execute the generator
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[1]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestQuery",
		    "kind": "HoudiniQuery",
		    "hash": "2b2b7a4583cf63472e32761a48d08eb7dc91696801383dabf2592e71a030aa53",

		    "raw": \`query TestQuery {
		  user {
		    firstName
		    ...A
		    id
		  }
		}

		fragment A on User {
		  firstName
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
		                        "firstName": {
		                            "type": "String",
		                            "keyRaw": "firstName"
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

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=2b2b7a4583cf63472e32761a48d08eb7dc91696801383dabf2592e71a030aa53";
	`)
})
test('interface to interface inline fragment', async function () {
	const docs = [
		mockCollectedDoc(`query MyQuery($id: ID!) {
			node(id: $id) {
				... on Friend {
					name
				}
			}
		}`),
	]
	// execute the generator
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "MyQuery",
		    "kind": "HoudiniQuery",
		    "hash": "1523b7370764395a57e1a2434ea2e40290ac99d80a27c92438f8f053c0055998",

		    "raw": \`query MyQuery($id: ID!) {
		  node(id: $id) {
		    ... on Friend {
		      name
		    }
		    id
		    __typename
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "node": {
		                "type": "Node",
		                "keyRaw": "node(id: $id)",
		                "nullable": true,

		                "selection": {
		                    "abstractFields": {
		                        "fields": {
		                            "Friend": {
		                                "name": {
		                                    "type": "String",
		                                    "keyRaw": "name"
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
		                        },

		                        "typeMap": {
		                            "User": "Friend",
		                            "Cat": "Friend"
		                        }
		                    },

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
		                },

		                "abstract": true
		            }
		        }
		    },

		    "input": {
		        "fields": {
		            "id": "ID"
		        },

		        "types": {}
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=1523b7370764395a57e1a2434ea2e40290ac99d80a27c92438f8f053c0055998";
	`)
})

test('paginate over unions', async function () {
	const docs = [
		mockCollectedDoc(
			`query TestQuery {
				entitiesByCursor(first: 10) @paginate(name: "All_Users") {
					edges {
						node {
							... on User {
								firstName
							}
						}
					}
				}
			}`
		),
	]
	// execute the generator
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestQuery",
		    "kind": "HoudiniQuery",
		    "hash": "d6ca2db811e0a7abc42c807692a571c8fdce242e5c2cfede85972d00b1eadaba",

		    "refetch": {
		        "path": ["entitiesByCursor"],
		        "method": "cursor",
		        "pageSize": 10,
		        "embedded": false,
		        "targetType": "Query",
		        "paginated": true,
		        "direction": "both"
		    },

		    "raw": \`query TestQuery($first: Int = 10, $after: String, $last: Int, $before: String) {
		  entitiesByCursor(first: $first, after: $after, last: $last, before: $before) {
		    edges {
		      node {
		        ... on User {
		          firstName
		        }
		        __typename
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

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "entitiesByCursor": {
		                "type": "EntityConnection",
		                "keyRaw": "entitiesByCursor::paginated",

		                "list": {
		                    "name": "All_Users",
		                    "connection": true,
		                    "type": "Entity"
		                },

		                "selection": {
		                    "fields": {
		                        "edges": {
		                            "type": "EntityEdge",
		                            "keyRaw": "edges",
		                            "updates": ["append", "prepend"],

		                            "selection": {
		                                "fields": {
		                                    "node": {
		                                        "type": "Entity",
		                                        "keyRaw": "node",
		                                        "nullable": true,

		                                        "selection": {
		                                            "abstractFields": {
		                                                "fields": {
		                                                    "User": {
		                                                        "firstName": {
		                                                            "type": "String",
		                                                            "keyRaw": "firstName"
		                                                        },

		                                                        "__typename": {
		                                                            "type": "String",
		                                                            "keyRaw": "__typename"
		                                                        }
		                                                    }
		                                                },

		                                                "typeMap": {}
		                                            },

		                                            "fields": {
		                                                "__typename": {
		                                                    "type": "String",
		                                                    "keyRaw": "__typename"
		                                                }
		                                            }
		                                        },

		                                        "abstract": true
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
		                },

		                "filters": {
		                    "first": {
		                        "kind": "Variable",
		                        "value": "first"
		                    },

		                    "after": {
		                        "kind": "Variable",
		                        "value": "after"
		                    },

		                    "last": {
		                        "kind": "Variable",
		                        "value": "last"
		                    },

		                    "before": {
		                        "kind": "Variable",
		                        "value": "before"
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
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=d6ca2db811e0a7abc42c807692a571c8fdce242e5c2cfede85972d00b1eadaba";
	`)
})

test('overlapping query and fragment nested selection', async function () {
	const docs = [
		mockCollectedDoc(`fragment A on User { friends { ... on User { id } } }`),
		mockCollectedDoc(`query TestQuery {  friends {... on User { firstName } ...A @prepend } }`),
	]

	// execute the generator
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[1]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestQuery",
		    "kind": "HoudiniQuery",
		    "hash": "f6eac6c179b0586180a17258646ae970409e055f4b3598d0e786b03d700c46d7",

		    "raw": \`query TestQuery {
		  friends {
		    ... on User {
		      firstName
		    }
		    ...A
		    __typename
		  }
		}

		fragment A on User {
		  friends {
		    ... on User {
		      id
		    }
		    id
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "friends": {
		                "type": "Friend",
		                "keyRaw": "friends",

		                "selection": {
		                    "abstractFields": {
		                        "fields": {
		                            "User": {
		                                "firstName": {
		                                    "type": "String",
		                                    "keyRaw": "firstName"
		                                },

		                                "friends": {
		                                    "type": "User",
		                                    "keyRaw": "friends",

		                                    "selection": {
		                                        "fields": {
		                                            "id": {
		                                                "type": "ID",
		                                                "keyRaw": "id"
		                                            }
		                                        }
		                                    }
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename"
		                                }
		                            }
		                        },

		                        "typeMap": {}
		                    },

		                    "fields": {
		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename"
		                        },

		                        "friends": {
		                            "type": "User",
		                            "keyRaw": "friends",

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

		                "abstract": true
		            }
		        }
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=f6eac6c179b0586180a17258646ae970409e055f4b3598d0e786b03d700c46d7";
	`)
})

test('selections with interfaces', async function () {
	const cfg = testConfig({ module: 'esm' })
	const docs = [
		mockCollectedDoc(
			`query Friends {
					friends {
                        ... on Cat {
                            id
							owner {
								firstName
							}
                        }
                        ... on Ghost {
                            name
                        }
					}
				}`
		),
	]

	// execute the generator
	await runPipeline(cfg, docs)

	// load the contents of the file
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "Friends",
		    "kind": "HoudiniQuery",
		    "hash": "359c4d6ceae8e5a5411fa160c2ffaf61e714d7c82a0f1816244f8a83291a2863",

		    "raw": \`query Friends {
		  friends {
		    ... on Cat {
		      id
		      owner {
		        firstName
		        id
		      }
		    }
		    ... on Ghost {
		      name
		    }
		    __typename
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "friends": {
		                "type": "Friend",
		                "keyRaw": "friends",

		                "selection": {
		                    "abstractFields": {
		                        "fields": {
		                            "Cat": {
		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id"
		                                },

		                                "owner": {
		                                    "type": "User",
		                                    "keyRaw": "owner",

		                                    "selection": {
		                                        "fields": {
		                                            "firstName": {
		                                                "type": "String",
		                                                "keyRaw": "firstName"
		                                            },

		                                            "id": {
		                                                "type": "ID",
		                                                "keyRaw": "id"
		                                            }
		                                        }
		                                    }
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename"
		                                }
		                            },

		                            "Ghost": {
		                                "name": {
		                                    "type": "String",
		                                    "keyRaw": "name"
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename"
		                                }
		                            }
		                        },

		                        "typeMap": {}
		                    },

		                    "fields": {
		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename"
		                        }
		                    }
		                },

		                "abstract": true
		            }
		        }
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=359c4d6ceae8e5a5411fa160c2ffaf61e714d7c82a0f1816244f8a83291a2863";
	`)
})

test('selections with unions', async function () {
	const cfg = testConfig({ module: 'esm' })
	const docs = [
		mockCollectedDoc(
			`query Friends {
					entities {
                        ... on Cat {
                            id
							owner {
								firstName
							}
                        }
                        ... on Ghost {
                            name
                        }
					}
				}`
		),
	]

	// execute the generator
	await runPipeline(cfg, docs)

	// verify contents
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "Friends",
		    "kind": "HoudiniQuery",
		    "hash": "512c81f0e5ea88525b407c9978620c931d4e8bc41317d9bd6eeaf3338fe40c6c",

		    "raw": \`query Friends {
		  entities {
		    ... on Cat {
		      id
		      owner {
		        firstName
		        id
		      }
		    }
		    ... on Ghost {
		      name
		    }
		    __typename
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "entities": {
		                "type": "Entity",
		                "keyRaw": "entities",

		                "selection": {
		                    "abstractFields": {
		                        "fields": {
		                            "Cat": {
		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id"
		                                },

		                                "owner": {
		                                    "type": "User",
		                                    "keyRaw": "owner",

		                                    "selection": {
		                                        "fields": {
		                                            "firstName": {
		                                                "type": "String",
		                                                "keyRaw": "firstName"
		                                            },

		                                            "id": {
		                                                "type": "ID",
		                                                "keyRaw": "id"
		                                            }
		                                        }
		                                    }
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename"
		                                }
		                            },

		                            "Ghost": {
		                                "name": {
		                                    "type": "String",
		                                    "keyRaw": "name"
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename"
		                                }
		                            }
		                        },

		                        "typeMap": {}
		                    },

		                    "fields": {
		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename"
		                        }
		                    }
		                },

		                "abstract": true
		            }
		        }
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=512c81f0e5ea88525b407c9978620c931d4e8bc41317d9bd6eeaf3338fe40c6c";
	`)
})

test('selections with overlapping unions', async function () {
	const cfg = testConfig({ module: 'esm' })
	const docs = [
		mockCollectedDoc(
			`query Friends {
					friends {
						name
                        ... on Cat {
                            id
							owner {
								firstName
							}
                        }
                        ... on Ghost {
                            name
                        }
					}
				}`
		),
	]

	// execute the generator
	await runPipeline(cfg, docs)

	// verify contents
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "Friends",
		    "kind": "HoudiniQuery",
		    "hash": "ac41a4527ca4141590bf31197f24b51cac54aad71c19ad0aba7843f2514a5700",

		    "raw": \`query Friends {
		  friends {
		    name
		    ... on Cat {
		      id
		      owner {
		        firstName
		        id
		      }
		    }
		    ... on Ghost {
		      name
		    }
		    __typename
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "friends": {
		                "type": "Friend",
		                "keyRaw": "friends",

		                "selection": {
		                    "abstractFields": {
		                        "fields": {
		                            "Cat": {
		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id"
		                                },

		                                "owner": {
		                                    "type": "User",
		                                    "keyRaw": "owner",

		                                    "selection": {
		                                        "fields": {
		                                            "firstName": {
		                                                "type": "String",
		                                                "keyRaw": "firstName"
		                                            },

		                                            "id": {
		                                                "type": "ID",
		                                                "keyRaw": "id"
		                                            }
		                                        }
		                                    }
		                                },

		                                "name": {
		                                    "type": "String",
		                                    "keyRaw": "name"
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename"
		                                }
		                            },

		                            "Ghost": {
		                                "name": {
		                                    "type": "String",
		                                    "keyRaw": "name"
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename"
		                                }
		                            }
		                        },

		                        "typeMap": {}
		                    },

		                    "fields": {
		                        "name": {
		                            "type": "String",
		                            "keyRaw": "name"
		                        },

		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename"
		                        }
		                    }
		                },

		                "abstract": true
		            }
		        }
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=ac41a4527ca4141590bf31197f24b51cac54aad71c19ad0aba7843f2514a5700";
	`)
})

test('selections with unions of abstract types', async function () {
	const cfg = testConfig({ module: 'esm' })
	const docs = [
		mockCollectedDoc(
			`query Friends {
				friends {
					... on Node {
						id

						... on Cat {
							owner {
								firstName
							}
						}
					}
					... on Ghost {
						name
					}
				}
			}`
		),
	]

	// execute the generator
	await runPipeline(cfg, docs)

	// verify contents
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "Friends",
		    "kind": "HoudiniQuery",
		    "hash": "d6251b9fad69d4c2395d036e1ba4eb8047be3b01e69670feaca6344b6214f218",

		    "raw": \`query Friends {
		  friends {
		    ... on Node {
		      id
		      ... on Cat {
		        owner {
		          firstName
		          id
		        }
		      }
		    }
		    ... on Ghost {
		      name
		    }
		    __typename
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "friends": {
		                "type": "Friend",
		                "keyRaw": "friends",

		                "selection": {
		                    "abstractFields": {
		                        "fields": {
		                            "Node": {
		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id"
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename"
		                                }
		                            },

		                            "Cat": {
		                                "owner": {
		                                    "type": "User",
		                                    "keyRaw": "owner",

		                                    "selection": {
		                                        "fields": {
		                                            "firstName": {
		                                                "type": "String",
		                                                "keyRaw": "firstName"
		                                            },

		                                            "id": {
		                                                "type": "ID",
		                                                "keyRaw": "id"
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
		                            },

		                            "Ghost": {
		                                "name": {
		                                    "type": "String",
		                                    "keyRaw": "name"
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename"
		                                }
		                            }
		                        },

		                        "typeMap": {
		                            "User": "Node"
		                        }
		                    },

		                    "fields": {
		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename"
		                        }
		                    }
		                },

		                "abstract": true
		            }
		        }
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=d6251b9fad69d4c2395d036e1ba4eb8047be3b01e69670feaca6344b6214f218";
	`)
})

test('selections with concrete types matching multiple abstract types', async function () {
	const cfg = testConfig({ module: 'esm' })
	const docs = [
		mockCollectedDoc(
			`query Friends {
				friends {
					... on CatOwner {
						cats {
							name
						}
					}
					... on Node {
						id
					}
					... on Ghost {
						aka
					}
				}
			}`
		),
	]

	// execute the generator
	await runPipeline(cfg, docs)

	// verify contents
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "Friends",
		    "kind": "HoudiniQuery",
		    "hash": "cb2649f407c51a76f03a222c15a6c16e36cc96dabf48465765a6c58d7d3345cb",

		    "raw": \`query Friends {
		  friends {
		    ... on CatOwner {
		      cats {
		        name
		        id
		      }
		    }
		    ... on Node {
		      id
		    }
		    ... on Ghost {
		      aka
		    }
		    __typename
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "friends": {
		                "type": "Friend",
		                "keyRaw": "friends",

		                "selection": {
		                    "abstractFields": {
		                        "fields": {
		                            "Node": {
		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id"
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename"
		                                }
		                            },

		                            "Ghost": {
		                                "aka": {
		                                    "type": "String",
		                                    "keyRaw": "aka"
		                                },

		                                "cats": {
		                                    "type": "Cat",
		                                    "keyRaw": "cats",

		                                    "selection": {
		                                        "fields": {
		                                            "name": {
		                                                "type": "String",
		                                                "keyRaw": "name"
		                                            },

		                                            "id": {
		                                                "type": "ID",
		                                                "keyRaw": "id"
		                                            }
		                                        }
		                                    }
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename"
		                                }
		                            },

		                            "User": {
		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id"
		                                },

		                                "cats": {
		                                    "type": "Cat",
		                                    "keyRaw": "cats",

		                                    "selection": {
		                                        "fields": {
		                                            "name": {
		                                                "type": "String",
		                                                "keyRaw": "name"
		                                            },

		                                            "id": {
		                                                "type": "ID",
		                                                "keyRaw": "id"
		                                            }
		                                        }
		                                    }
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename"
		                                }
		                            }
		                        },

		                        "typeMap": {
		                            "Cat": "Node"
		                        }
		                    },

		                    "fields": {
		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename"
		                        }
		                    }
		                },

		                "abstract": true
		            }
		        }
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=cb2649f407c51a76f03a222c15a6c16e36cc96dabf48465765a6c58d7d3345cb";
	`)
})

describe('mutation artifacts', function () {
	test('empty operation list', async function () {
		const cfg = testConfig({ module: 'esm' })

		const docs = [
			mockCollectedDoc(
				`mutation B {
					addFriend {
						friend {
							firstName
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(cfg, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "B",
			    "kind": "HoudiniMutation",
			    "hash": "38005b47351eb4e6e14e3c13a8d0d206dac09bf80d6fa3c103a060a3990edd37",

			    "raw": \`mutation B {
			  addFriend {
			    friend {
			      firstName
			      id
			    }
			  }
			}
			\`,

			    "rootType": "Mutation",

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "selection": {
			                                "fields": {
			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
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
			};

			"HoudiniHash=38005b47351eb4e6e14e3c13a8d0d206dac09bf80d6fa3c103a060a3990edd37";
		`)
	})

	test('insert operation', async function () {
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "7bddb252a5c941ed1e040edcbf56dca758bf43f9a641d0644bd74610dd815804",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
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
			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id"
			                                    },

			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    }
			                                }
			                            }
			                        }
			                    }
			                }
			            }
			        }
			    }
			};

			"HoudiniHash=7bddb252a5c941ed1e040edcbf56dca758bf43f9a641d0644bd74610dd815804";
		`)
	})

	test('insert operation allList', async function () {
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @allLists
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "1ace165aa94ed9e7726f83aee9fc23a1bf3bc6943b21e5a6eb79d325bda2037d",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
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
			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id"
			                                    },

			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    }
			                                }
			                            }
			                        }
			                    }
			                }
			            }
			        }
			    }
			};

			"HoudiniHash=1ace165aa94ed9e7726f83aee9fc23a1bf3bc6943b21e5a6eb79d325bda2037d";
		`)
	})

	test('insert operation allList by default in config', async function () {
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		let configUpdate = testConfig()
		configUpdate.defaultListTarget = 'all'

		// execute the generator
		await runPipeline(configUpdate, docs)

		// verify contents
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "7bddb252a5c941ed1e040edcbf56dca758bf43f9a641d0644bd74610dd815804",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
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
			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id"
			                                    },

			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    }
			                                }
			                            }
			                        }
			                    }
			                }
			            }
			        }
			    }
			};

			"HoudiniHash=7bddb252a5c941ed1e040edcbf56dca758bf43f9a641d0644bd74610dd815804";
		`)
	})

	test('insert operation cosition first by default in config', async function () {
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		let configUpdate = testConfig()
		configUpdate.internalListPosition = 'first'

		// execute the generator
		await runPipeline(configUpdate, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "7bddb252a5c941ed1e040edcbf56dca758bf43f9a641d0644bd74610dd815804",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "insert",
			                                "list": "All_Users",
			                                "position": "first"
			                            }],

			                            "selection": {
			                                "fields": {
			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id"
			                                    },

			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    }
			                                }
			                            }
			                        }
			                    }
			                }
			            }
			        }
			    }
			};

			"HoudiniHash=7bddb252a5c941ed1e040edcbf56dca758bf43f9a641d0644bd74610dd815804";
		`)
	})

	test('toggle operation', async function () {
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_toggle @prepend
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "990e2965b8831a841ccfe9bebf7229ea00166868476b328f770b116130c3f42d",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_toggle
			      id
			    }
			  }
			}

			fragment All_Users_toggle on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "toggle",
			                                "list": "All_Users",
			                                "position": "first"
			                            }],

			                            "selection": {
			                                "fields": {
			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id"
			                                    },

			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    }
			                                }
			                            }
			                        }
			                    }
			                }
			            }
			        }
			    }
			};

			"HoudiniHash=990e2965b8831a841ccfe9bebf7229ea00166868476b328f770b116130c3f42d";
		`)
	})

	test('remove operation', async function () {
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_remove
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "53d67f88e1abda8015c60186a94958017c49f87557a4f73d294a29f93ceb9b27",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_remove
			      id
			    }
			  }
			}

			fragment All_Users_remove on User {
			  id
			}
			\`,

			    "rootType": "Mutation",

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "remove",
			                                "list": "All_Users"
			                            }],

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
			};

			"HoudiniHash=53d67f88e1abda8015c60186a94958017c49f87557a4f73d294a29f93ceb9b27";
		`)
	})

	test('delete operation', async function () {
		const docs = [
			mockCollectedDoc(
				`mutation A {
					deleteUser(id: "1234") {
						userID @User_delete
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "6c4aa888de2c2a05141a862b3a1170cf72d4886803aab0c6c661d1dce8e959a0",

			    "raw": \`mutation A {
			  deleteUser(id: "1234") {
			    userID
			  }
			}
			\`,

			    "rootType": "Mutation",

			    "selection": {
			        "fields": {
			            "deleteUser": {
			                "type": "DeleteUserOutput",
			                "keyRaw": "deleteUser(id: \\"1234\\")",

			                "selection": {
			                    "fields": {
			                        "userID": {
			                            "type": "ID",
			                            "keyRaw": "userID",

			                            "operations": [{
			                                "action": "delete",
			                                "type": "User"
			                            }]
			                        }
			                    }
			                }
			            }
			        }
			    }
			};

			"HoudiniHash=6c4aa888de2c2a05141a862b3a1170cf72d4886803aab0c6c661d1dce8e959a0";
		`)
	})

	test('delete operation with condition', async function () {
		const docs = [
			mockCollectedDoc(
				`mutation A {
					deleteUser(id: "1234") {
						userID @User_delete @when(stringValue: "foo")
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "7307440390e78bff1b686f1acdbfba92b20c43beef6b33085702c688b2a7ed2a",

			    "raw": \`mutation A {
			  deleteUser(id: "1234") {
			    userID
			  }
			}
			\`,

			    "rootType": "Mutation",

			    "selection": {
			        "fields": {
			            "deleteUser": {
			                "type": "DeleteUserOutput",
			                "keyRaw": "deleteUser(id: \\"1234\\")",

			                "selection": {
			                    "fields": {
			                        "userID": {
			                            "type": "ID",
			                            "keyRaw": "userID",

			                            "operations": [{
			                                "action": "delete",
			                                "type": "User",

			                                "when": {
			                                    "must": {
			                                        "stringValue": "foo"
			                                    }
			                                }
			                            }]
			                        }
			                    }
			                }
			            }
			        }
			    }
			};

			"HoudiniHash=7307440390e78bff1b686f1acdbfba92b20c43beef6b33085702c688b2a7ed2a";
		`)
	})

	test('parentID - prepend', async function () {
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @prepend @parentID(value: "1234")
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "b28d7083542a75e7c9feb094bd5fd450406f32c28f89aa4ebc69be85cf4eb38d",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "insert",
			                                "list": "All_Users",
			                                "position": "first",

			                                "parentID": {
			                                    "kind": "String",
			                                    "value": "1234"
			                                }
			                            }],

			                            "selection": {
			                                "fields": {
			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id"
			                                    },

			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    }
			                                }
			                            }
			                        }
			                    }
			                }
			            }
			        }
			    }
			};

			"HoudiniHash=b28d7083542a75e7c9feb094bd5fd450406f32c28f89aa4ebc69be85cf4eb38d";
		`)
	})

	test('parentID - append', async function () {
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @append @parentID(value: "1234")
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "f863fc8aa42ab14affba68ba24af2bfe87ccdc9edbc10f838515c76ed5064a4d",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "insert",
			                                "list": "All_Users",
			                                "position": "last",

			                                "parentID": {
			                                    "kind": "String",
			                                    "value": "1234"
			                                }
			                            }],

			                            "selection": {
			                                "fields": {
			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id"
			                                    },

			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    }
			                                }
			                            }
			                        }
			                    }
			                }
			            }
			        }
			    }
			};

			"HoudiniHash=f863fc8aa42ab14affba68ba24af2bfe87ccdc9edbc10f838515c76ed5064a4d";
		`)
	})

	test('parentID - parentID directive', async function () {
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @parentID(value: "1234")
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "87e994c2b3548fe3da2df882cbc1b6263cbf9328032b796a7044c96fde59d579",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "insert",
			                                "list": "All_Users",
			                                "position": "last",

			                                "parentID": {
			                                    "kind": "String",
			                                    "value": "1234"
			                                }
			                            }],

			                            "selection": {
			                                "fields": {
			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id"
			                                    },

			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    }
			                                }
			                            }
			                        }
			                    }
			                }
			            }
			        }
			    }
			};

			"HoudiniHash=87e994c2b3548fe3da2df882cbc1b6263cbf9328032b796a7044c96fde59d579";
		`)
	})

	test('must - prepend', async function () {
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @prepend(when: { stringValue: "foo" })
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "0480120cec7ca6a7b187d0203fd645dd75baa9236247c8e8943d194d7b1935e3",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "insert",
			                                "list": "All_Users",
			                                "position": "first",

			                                "when": {
			                                    "must": {
			                                        "stringValue": "foo"
			                                    }
			                                }
			                            }],

			                            "selection": {
			                                "fields": {
			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id"
			                                    },

			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    }
			                                }
			                            }
			                        }
			                    }
			                }
			            }
			        }
			    }
			};

			"HoudiniHash=0480120cec7ca6a7b187d0203fd645dd75baa9236247c8e8943d194d7b1935e3";
		`)
	})

	test('must - append', async function () {
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @append(when: { stringValue: "true" })
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "5fe91970d4442ed25b70b5d6e41e5b0e319a17460edc3ac3cdcd2ec25623a81d",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "insert",
			                                "list": "All_Users",
			                                "position": "last",

			                                "when": {
			                                    "must": {
			                                        "stringValue": "true"
			                                    }
			                                }
			                            }],

			                            "selection": {
			                                "fields": {
			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id"
			                                    },

			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    }
			                                }
			                            }
			                        }
			                    }
			                }
			            }
			        }
			    }
			};

			"HoudiniHash=5fe91970d4442ed25b70b5d6e41e5b0e319a17460edc3ac3cdcd2ec25623a81d";
		`)
	})

	test('must - directive', async function () {
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @when(stringValue: "true")
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "30a2a341bbaa9077aa45ab36bb40438e75ce0ae8b76d9163e9ed3ad6d2d6871f",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "insert",
			                                "list": "All_Users",
			                                "position": "last",

			                                "when": {
			                                    "must": {
			                                        "stringValue": "true"
			                                    }
			                                }
			                            }],

			                            "selection": {
			                                "fields": {
			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id"
			                                    },

			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    }
			                                }
			                            }
			                        }
			                    }
			                }
			            }
			        }
			    }
			};

			"HoudiniHash=30a2a341bbaa9077aa45ab36bb40438e75ce0ae8b76d9163e9ed3ad6d2d6871f";
		`)
	})

	test('must_not - prepend', async function () {
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @prepend(when_not: { stringValue: "true" })
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "04a71dfa4434b13a8673632d09f7daa80ef30dd8ed6ad83cf141d6fff35ceb93",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "insert",
			                                "list": "All_Users",
			                                "position": "first",

			                                "when": {
			                                    "must_not": {
			                                        "stringValue": "true"
			                                    }
			                                }
			                            }],

			                            "selection": {
			                                "fields": {
			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id"
			                                    },

			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    }
			                                }
			                            }
			                        }
			                    }
			                }
			            }
			        }
			    }
			};

			"HoudiniHash=04a71dfa4434b13a8673632d09f7daa80ef30dd8ed6ad83cf141d6fff35ceb93";
		`)
	})

	test('must_not - append', async function () {
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @append(when_not: { stringValue: "true" })
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "22bfd731c29a9db2cbe06a44ab3aca2bf51e4d756732469270a7988d31431b34",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "insert",
			                                "list": "All_Users",
			                                "position": "last",

			                                "when": {
			                                    "must_not": {
			                                        "stringValue": "true"
			                                    }
			                                }
			                            }],

			                            "selection": {
			                                "fields": {
			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id"
			                                    },

			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    }
			                                }
			                            }
			                        }
			                    }
			                }
			            }
			        }
			    }
			};

			"HoudiniHash=22bfd731c29a9db2cbe06a44ab3aca2bf51e4d756732469270a7988d31431b34";
		`)
	})

	test('list filters', async function () {
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @when_not(boolValue: true)
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery($value: String!) {
					users(
						stringValue: $value,
						boolValue: true,
						floatValue: 1.2,
						intValue: 1,
					) @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[1]).toMatchInlineSnapshot(`
			export default {
			    "name": "TestQuery",
			    "kind": "HoudiniQuery",
			    "hash": "ccbdb79d543a528bcbf836ed8f339e5e848ddda14122467be3c0a0084970989a",

			    "raw": \`query TestQuery($value: String!) {
			  users(stringValue: $value, boolValue: true, floatValue: 1.2, intValue: 1) {
			    firstName
			    id
			  }
			}
			\`,

			    "rootType": "Query",

			    "selection": {
			        "fields": {
			            "users": {
			                "type": "User",
			                "keyRaw": "users(boolValue: true, floatValue: 1.2, intValue: 1, stringValue: $value)",

			                "list": {
			                    "name": "All_Users",
			                    "connection": false,
			                    "type": "User"
			                },

			                "selection": {
			                    "fields": {
			                        "firstName": {
			                            "type": "String",
			                            "keyRaw": "firstName"
			                        },

			                        "id": {
			                            "type": "ID",
			                            "keyRaw": "id"
			                        }
			                    }
			                },

			                "filters": {
			                    "stringValue": {
			                        "kind": "Variable",
			                        "value": "value"
			                    },

			                    "boolValue": {
			                        "kind": "Boolean",
			                        "value": true
			                    },

			                    "floatValue": {
			                        "kind": "Float",
			                        "value": 1.2
			                    },

			                    "intValue": {
			                        "kind": "Int",
			                        "value": 1
			                    }
			                }
			            }
			        }
			    },

			    "input": {
			        "fields": {
			            "value": "String"
			        },

			        "types": {}
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=ccbdb79d543a528bcbf836ed8f339e5e848ddda14122467be3c0a0084970989a";
		`)
	})

	test('must_not - directive', async function () {
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @when_not(boolValue: true)
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo", boolValue:true) @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "992d537a3acd5a04aa2fe46eb0ec470fa98e3e6c2b86c1fa309c788d7aff5b5d",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "insert",
			                                "list": "All_Users",
			                                "position": "last",

			                                "when": {
			                                    "must_not": {
			                                        "boolValue": true
			                                    }
			                                }
			                            }],

			                            "selection": {
			                                "fields": {
			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id"
			                                    },

			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    }
			                                }
			                            }
			                        }
			                    }
			                }
			            }
			        }
			    }
			};

			"HoudiniHash=992d537a3acd5a04aa2fe46eb0ec470fa98e3e6c2b86c1fa309c788d7aff5b5d";
		`)
	})

	test('tracks list name', async function () {
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @prepend @parentID(value: "1234")
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[1]).toMatchInlineSnapshot(`
			export default {
			    "name": "TestQuery",
			    "kind": "HoudiniQuery",
			    "hash": "1c46f4ffe75f795e3e541537d487ed68d4fbfff0c56fb2868f69a1f1c6f91a68",

			    "raw": \`query TestQuery {
			  users(stringValue: "foo") {
			    firstName
			    id
			  }
			}
			\`,

			    "rootType": "Query",

			    "selection": {
			        "fields": {
			            "users": {
			                "type": "User",
			                "keyRaw": "users(stringValue: \\"foo\\")",

			                "list": {
			                    "name": "All_Users",
			                    "connection": false,
			                    "type": "User"
			                },

			                "selection": {
			                    "fields": {
			                        "firstName": {
			                            "type": "String",
			                            "keyRaw": "firstName"
			                        },

			                        "id": {
			                            "type": "ID",
			                            "keyRaw": "id"
			                        }
			                    }
			                },

			                "filters": {
			                    "stringValue": {
			                        "kind": "String",
			                        "value": "foo"
			                    }
			                }
			            }
			        }
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=1c46f4ffe75f795e3e541537d487ed68d4fbfff0c56fb2868f69a1f1c6f91a68";
		`)
	})

	test('tracks paginate name', async function () {
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @prepend @parentID(value: "1234")
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					usersByCursor(first: 10) @paginate(name: "All_Users") {
						edges {
							node {
								firstName
							}
						}
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[1]).toMatchInlineSnapshot(`
			export default {
			    "name": "TestQuery",
			    "kind": "HoudiniQuery",
			    "hash": "e7c8527dff05fb4987ebc30613d6826c73c0cc47c62f212feb00bd43356c00dc",

			    "refetch": {
			        "path": ["usersByCursor"],
			        "method": "cursor",
			        "pageSize": 10,
			        "embedded": false,
			        "targetType": "Query",
			        "paginated": true,
			        "direction": "both"
			    },

			    "raw": \`query TestQuery($first: Int = 10, $after: String, $last: Int, $before: String) {
			  usersByCursor(first: $first, after: $after, last: $last, before: $before) {
			    edges {
			      node {
			        firstName
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

			    "rootType": "Query",

			    "selection": {
			        "fields": {
			            "usersByCursor": {
			                "type": "UserConnection",
			                "keyRaw": "usersByCursor::paginated",

			                "list": {
			                    "name": "All_Users",
			                    "connection": true,
			                    "type": "User"
			                },

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
			                                                "firstName": {
			                                                    "type": "String",
			                                                    "keyRaw": "firstName"
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
			                },

			                "filters": {
			                    "first": {
			                        "kind": "Variable",
			                        "value": "first"
			                    },

			                    "after": {
			                        "kind": "Variable",
			                        "value": "after"
			                    },

			                    "last": {
			                        "kind": "Variable",
			                        "value": "last"
			                    },

			                    "before": {
			                        "kind": "Variable",
			                        "value": "before"
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
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=e7c8527dff05fb4987ebc30613d6826c73c0cc47c62f212feb00bd43356c00dc";
		`)
	})

	test('field args', async function () {
		const docs = [
			mockCollectedDoc(
				`query TestQuery($value: String!) {
					users(
						stringValue: $value,
						boolValue: true,
						floatValue: 1.2,
						intValue: 1,
					) @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "TestQuery",
			    "kind": "HoudiniQuery",
			    "hash": "ccbdb79d543a528bcbf836ed8f339e5e848ddda14122467be3c0a0084970989a",

			    "raw": \`query TestQuery($value: String!) {
			  users(stringValue: $value, boolValue: true, floatValue: 1.2, intValue: 1) {
			    firstName
			    id
			  }
			}
			\`,

			    "rootType": "Query",

			    "selection": {
			        "fields": {
			            "users": {
			                "type": "User",
			                "keyRaw": "users(boolValue: true, floatValue: 1.2, intValue: 1, stringValue: $value)",

			                "list": {
			                    "name": "All_Users",
			                    "connection": false,
			                    "type": "User"
			                },

			                "selection": {
			                    "fields": {
			                        "firstName": {
			                            "type": "String",
			                            "keyRaw": "firstName"
			                        },

			                        "id": {
			                            "type": "ID",
			                            "keyRaw": "id"
			                        }
			                    }
			                },

			                "filters": {
			                    "stringValue": {
			                        "kind": "Variable",
			                        "value": "value"
			                    },

			                    "boolValue": {
			                        "kind": "Boolean",
			                        "value": true
			                    },

			                    "floatValue": {
			                        "kind": "Float",
			                        "value": 1.2
			                    },

			                    "intValue": {
			                        "kind": "Int",
			                        "value": 1
			                    }
			                }
			            }
			        }
			    },

			    "input": {
			        "fields": {
			            "value": "String"
			        },

			        "types": {}
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=ccbdb79d543a528bcbf836ed8f339e5e848ddda14122467be3c0a0084970989a";
		`)
	})

	test('sveltekit', async function () {
		const cfg = testConfig({ module: 'esm' })

		const docs = [
			mockCollectedDoc(
				`query TestQuery($value: String!) {
					users(
						stringValue: $value,
						boolValue: true,
						floatValue: 1.2,
						intValue: 1,
					) @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(cfg, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "TestQuery",
			    "kind": "HoudiniQuery",
			    "hash": "ccbdb79d543a528bcbf836ed8f339e5e848ddda14122467be3c0a0084970989a",

			    "raw": \`query TestQuery($value: String!) {
			  users(stringValue: $value, boolValue: true, floatValue: 1.2, intValue: 1) {
			    firstName
			    id
			  }
			}
			\`,

			    "rootType": "Query",

			    "selection": {
			        "fields": {
			            "users": {
			                "type": "User",
			                "keyRaw": "users(boolValue: true, floatValue: 1.2, intValue: 1, stringValue: $value)",

			                "list": {
			                    "name": "All_Users",
			                    "connection": false,
			                    "type": "User"
			                },

			                "selection": {
			                    "fields": {
			                        "firstName": {
			                            "type": "String",
			                            "keyRaw": "firstName"
			                        },

			                        "id": {
			                            "type": "ID",
			                            "keyRaw": "id"
			                        }
			                    }
			                },

			                "filters": {
			                    "stringValue": {
			                        "kind": "Variable",
			                        "value": "value"
			                    },

			                    "boolValue": {
			                        "kind": "Boolean",
			                        "value": true
			                    },

			                    "floatValue": {
			                        "kind": "Float",
			                        "value": 1.2
			                    },

			                    "intValue": {
			                        "kind": "Int",
			                        "value": 1
			                    }
			                }
			            }
			        }
			    },

			    "input": {
			        "fields": {
			            "value": "String"
			        },

			        "types": {}
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=ccbdb79d543a528bcbf836ed8f339e5e848ddda14122467be3c0a0084970989a";
		`)
	})
})

test('custom scalar shows up in artifact', async function () {
	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`query TestQuery { version }`),
		mockCollectedDoc(`fragment TestFragment on User { firstName }`),
	]

	// define a config with a custom scalar
	const localConfig = testConfig({
		schema: `
			scalar DateTime
			type TodoItem {
				text: String!
				createdAt: DateTime!
			}
			type Query {
				allItems: [TodoItem!]!
			}
		`,
		scalars: {
			DateTime: {
				type: 'Date',
				unmarshal(val: number): Date {
					return new Date(val)
				},
				marshal(date: Date): number {
					return date.getTime()
				},
			},
		},
	})

	// execute the generator
	await runPipeline(localConfig, [mockCollectedDoc(`query TestQuery { allItems { createdAt } }`)])

	// load the contents of the file
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestQuery",
		    "kind": "HoudiniQuery",
		    "hash": "b8314df1f7d924f76e6dfe6e7e3c8efd593db931c67c892311e97a9ec1d429b4",

		    "raw": \`query TestQuery {
		  allItems {
		    createdAt
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "allItems": {
		                "type": "TodoItem",
		                "keyRaw": "allItems",

		                "selection": {
		                    "fields": {
		                        "createdAt": {
		                            "type": "DateTime",
		                            "keyRaw": "createdAt"
		                        }
		                    }
		                }
		            }
		        }
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=b8314df1f7d924f76e6dfe6e7e3c8efd593db931c67c892311e97a9ec1d429b4";
	`)
})

test('operation inputs', async function () {
	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`query TestQuery { version }`),
		mockCollectedDoc(`fragment TestFragment on User { firstName }`),
	]

	// the config to use in tests
	const localConfig = testConfig({
		schema: `
		enum MyEnum {
			Hello
		}

		input UserFilter {
			middle: NestedUserFilter
			listRequired: [String!]!
			nullList: [String]
			recursive: UserFilter
			enum: MyEnum
		}

		input NestedUserFilter {
			id: ID!
			firstName: String!
			admin: Boolean
			age: Int
			weight: Float
		}

		type User {
			id: ID!
		}

		type Query {
			user(id: ID, filter: UserFilter, filterList: [UserFilter!], enumArg: MyEnum): User
		}
	`,
	})

	// execute the generator
	await runPipeline(localConfig, [
		mockCollectedDoc(
			`
			query TestQuery(
				$id: ID,
				$filter: UserFilter,
				$filterList: [UserFilter!],
				$enumArg: MyEnum
			) {
				user(
					id: $id,
					filter: $filter,
					filterList: $filterList,
					enumArg: $enumArg,
				) {
					id
				}
			}
			`
		),
	])

	// load the contents of the file
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestQuery",
		    "kind": "HoudiniQuery",
		    "hash": "f39d9c24c97c9c3cdcd916272e7ffb9d79cb4ad08ec294c829d647d4238c7e6b",

		    "raw": \`query TestQuery($id: ID, $filter: UserFilter, $filterList: [UserFilter!], $enumArg: MyEnum) {
		  user(id: $id, filter: $filter, filterList: $filterList, enumArg: $enumArg) {
		    id
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "user": {
		                "type": "User",
		                "keyRaw": "user(enumArg: $enumArg, filter: $filter, filterList: $filterList, id: $id)",
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
		    },

		    "input": {
		        "fields": {
		            "id": "ID",
		            "filter": "UserFilter",
		            "filterList": "UserFilter",
		            "enumArg": "MyEnum"
		        },

		        "types": {
		            "NestedUserFilter": {
		                "id": "ID",
		                "firstName": "String",
		                "admin": "Boolean",
		                "age": "Int",
		                "weight": "Float"
		            },

		            "UserFilter": {
		                "middle": "NestedUserFilter",
		                "listRequired": "String",
		                "nullList": "String",
		                "recursive": "UserFilter",
		                "enum": "MyEnum"
		            }
		        }
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=f39d9c24c97c9c3cdcd916272e7ffb9d79cb4ad08ec294c829d647d4238c7e6b";
	`)
})

describe('subscription artifacts', function () {
	test('happy path', async function () {
		const docs = [
			mockCollectedDoc(
				`subscription B {
					newUser {
						user {
							firstName
						}
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "B",
			    "kind": "HoudiniSubscription",
			    "hash": "755fb65bebc83835db68921b7e193809246fb6f9ee2e37cc66d7314b91a501e7",

			    "raw": \`subscription B {
			  newUser {
			    user {
			      firstName
			      id
			    }
			  }
			}
			\`,

			    "rootType": "Subscription",

			    "selection": {
			        "fields": {
			            "newUser": {
			                "type": "NewUserResult",
			                "keyRaw": "newUser",

			                "selection": {
			                    "fields": {
			                        "user": {
			                            "type": "User",
			                            "keyRaw": "user",

			                            "selection": {
			                                "fields": {
			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
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
			};

			"HoudiniHash=755fb65bebc83835db68921b7e193809246fb6f9ee2e37cc66d7314b91a501e7";
		`)
	})
})

test('some artifact_data added to artifact specific to plugins', async function () {
	config.plugins = [
		{
			name: 'plugin-tmp1',
			filepath: '',
			artifact_data: () => {
				return {
					added_stuff: { yop: 'true' },
				}
			},
		},
		{
			name: 'plugin-tmp2',
			filepath: '',
		},
	]

	// the documents to test
	const docs: Document[] = [mockCollectedDoc(`query TestQuery { version }`)]

	// execute the generator
	await runPipeline(config, docs)

	// load the contents of the file
	// We should have nothing related to plugin-tmp2
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestQuery",
		    "kind": "HoudiniQuery",
		    "hash": "8e483259f3d69f416c01b6106c0440fa0f916abb4cadb75273f8226a1ff0a5e2",

		    "raw": \`query TestQuery {
		  version
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "version": {
		                "type": "Int",
		                "keyRaw": "version"
		            }
		        }
		    },

		    "plugin_data": {
		        "plugin-tmp1": {
		            "added_stuff": {
		                "yop": "true"
		            }
		        }
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=8e483259f3d69f416c01b6106c0440fa0f916abb4cadb75273f8226a1ff0a5e2";
	`)
})
