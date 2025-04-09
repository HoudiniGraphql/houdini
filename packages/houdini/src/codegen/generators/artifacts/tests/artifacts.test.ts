import { test, expect, describe } from 'vitest'

import { runPipeline } from '../../..'
import type { Document } from '../../../../lib'
import { fs } from '../../../../lib'
import { mockCollectedDoc, testConfig } from '../../../../test'

test('generates an artifact for every document', async function () {
	// the config to use in tests
	const config = testConfig()
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
	// the config to use in tests
	const config = testConfig()
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
		    "hash": "24015ccbaa62e80c1a1364e01cf181591c9fbb03da6a9b32da97fb23f820ff78",

		    "raw": \`query TestQuery {
		  version
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "version": {
		                "type": "Int",
		                "keyRaw": "version",
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=4e7afee5e8aa689ee7f58f61f60955769c29fe630b05a32ca2a5d8f61620afe3";
	`)

	expect(docs[1]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestFragment",
		    "kind": "HoudiniFragment",
		    "hash": "084581b5154b8485bdbac1f29137b551205bf1ca4eca635a84199e16cbceb5f1",

		    "raw": \`fragment TestFragment on User {
		  firstName
		  id
		  __typename
		}\`,

		    "rootType": "User",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "firstName": {
		                "type": "String",
		                "keyRaw": "firstName",
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

		    "pluginData": {}
		};

		"HoudiniHash=7af5be069af3b67c394042bdd7c12f46058ba9d372d38e67f5613fc3d0a2aaff";
	`)
})

test('selection includes fragments', async function () {
	// the config to use in tests
	const config = testConfig()
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
		    "hash": "be3aa33c62c8e8d6570339b1034fd11cd37ce9c76eb5e8bee2d770570eeb663c",

		    "raw": \`query TestQuery {
		  user {
		    ...TestFragment
		    id
		  }
		}

		fragment TestFragment on User {
		  firstName
		  id
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

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
		                            "keyRaw": "id",
		                            "visible": true
		                        },

		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename"
		                        }
		                    },

		                    "fragments": {
		                        "TestFragment": {
		                            "arguments": {}
		                        }
		                    }
		                },

		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=c8c8290bb733a727894c836300cd22e8ece993f2b7c2108998f1d63a595e6b5f";
	`)

	expect(selectionDocs[1]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestFragment",
		    "kind": "HoudiniFragment",
		    "hash": "084581b5154b8485bdbac1f29137b551205bf1ca4eca635a84199e16cbceb5f1",

		    "raw": \`fragment TestFragment on User {
		  firstName
		  id
		  __typename
		}\`,

		    "rootType": "User",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "firstName": {
		                "type": "String",
		                "keyRaw": "firstName",
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

		    "pluginData": {}
		};

		"HoudiniHash=7af5be069af3b67c394042bdd7c12f46058ba9d372d38e67f5613fc3d0a2aaff";
	`)
})

test('internal directives are scrubbed', async function () {
	// the config to use in tests
	const config = testConfig()
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
		    "hash": "83519c640b07a6266d2e3e2c117746f72f94478eb2f46ad747901ca88450bbe4",

		    "raw": \`query TestQuery {
		  user {
		    ...A
		    id
		  }
		}

		fragment A on User {
		  firstName
		  id
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

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
		                            "keyRaw": "id",
		                            "visible": true
		                        },

		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename"
		                        }
		                    },

		                    "fragments": {
		                        "A": {
		                            "arguments": {}
		                        }
		                    }
		                },

		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=44c6f321536709f2a75b34d7bf4a4db2387bed848fd2956e592a13817d1399ff";
	`)
})

test('variables only used by internal directives are scrubbed', async function () {
	// the config to use in tests
	const config = testConfig()
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
		    "hash": "83519c640b07a6266d2e3e2c117746f72f94478eb2f46ad747901ca88450bbe4",

		    "raw": \`query TestQuery {
		  user {
		    ...A
		    id
		  }
		}

		fragment A on User {
		  firstName
		  id
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": ["parentID"],

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
		                            "keyRaw": "id",
		                            "visible": true
		                        },

		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename"
		                        }
		                    },

		                    "fragments": {
		                        "A": {
		                            "arguments": {}
		                        }
		                    }
		                },

		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},

		    "input": {
		        "fields": {
		            "parentID": "ID"
		        },

		        "types": {},
		        "defaults": {},
		        "runtimeScalars": {}
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=718f5256e7eb831d556ed5b26e0afdccb6db8e63715b04f60314483808d3b697";
	`)
})

test('overlapping query and fragment selection', async function () {
	// the config to use in tests
	const config = testConfig()
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
		    "hash": "2cc5cddc44bdcc3c42322c0aef974f10ac714f1a861e2e63f8ee25648df985c1",

		    "raw": \`query TestQuery {
		  user {
		    firstName
		    ...A
		    id
		  }
		}

		fragment A on User {
		  firstName
		  id
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "user": {
		                "type": "User",
		                "keyRaw": "user",

		                "selection": {
		                    "fields": {
		                        "firstName": {
		                            "type": "String",
		                            "keyRaw": "firstName",
		                            "visible": true
		                        },

		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id",
		                            "visible": true
		                        },

		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename"
		                        }
		                    },

		                    "fragments": {
		                        "A": {
		                            "arguments": {}
		                        }
		                    }
		                },

		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=234b7407fd0adcee65c73e0a206119449dee083c784bddff5bf4a9ef726a1dba";
	`)
})
test('interface to interface inline fragment', async function () {
	// the config to use in tests
	const config = testConfig()
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
		    "hash": "a330dcfec5abb4d00d38bc218e20f21e21be6366d48d81636a07c42ddac9d11f",

		    "raw": \`query MyQuery($id: ID!) {
		  node(id: $id) {
		    ... on Friend {
		      name
		    }
		    id
		    __typename
		  }
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

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
		                                    "keyRaw": "name",
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

		                        "typeMap": {
		                            "User": "Friend",
		                            "Cat": "Friend"
		                        }
		                    },

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

		                "abstract": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},

		    "input": {
		        "fields": {
		            "id": "ID"
		        },

		        "types": {},
		        "defaults": {},
		        "runtimeScalars": {}
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=cdea6608b2807ec242d9a2deb5fbde0f907ab04a23b8f3f8bbf5ced2ec6c70c6";
	`)
})

test('paginate over unions', async function () {
	// the config to use in tests
	const config = testConfig()
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
		    "hash": "e1be854a9b8a951f7fa92a153f9325cb3959eb79e9405742172585c60aad1e18",

		    "refetch": {
		        "path": ["entitiesByCursor"],
		        "method": "cursor",
		        "pageSize": 10,
		        "embedded": false,
		        "targetType": "Query",
		        "paginated": true,
		        "direction": "both",
		        "mode": "Infinite"
		    },

		    "raw": \`query TestQuery($first: Int = 10, $after: String, $last: Int, $before: String) {
		  entitiesByCursor(first: $first, after: $after, last: $last, before: $before) {
		    edges {
		      node {
		        ... on User {
		          firstName
		          id
		        }
		        __typename
		      }
		    }
		    edges {
		      cursor
		      node {
		        __typename
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

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "entitiesByCursor": {
		                "type": "EntityConnection",
		                "keyRaw": "entitiesByCursor::paginated",

		                "directives": [{
		                    "name": "paginate",

		                    "arguments": {
		                        "name": {
		                            "kind": "StringValue",
		                            "value": "All_Users"
		                        },

		                        "connection": {
		                            "kind": "BooleanValue",
		                            "value": true
		                        }
		                    }
		                }],

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
		                                                            "keyRaw": "firstName",
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

		                                                "typeMap": {}
		                                            },

		                                            "fields": {
		                                                "__typename": {
		                                                    "type": "String",
		                                                    "keyRaw": "__typename",
		                                                    "visible": true
		                                                }
		                                            }
		                                        },

		                                        "abstract": true,
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
		            "after": "String",
		            "last": "Int",
		            "before": "String"
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

		"HoudiniHash=98c1fdc2506e4a951db5819b1c2a712c376e5190ec86b3cc3020babcbf667a63";
	`)
})

test('overlapping query and fragment nested selection', async function () {
	// the config to use in tests
	const config = testConfig()
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
		    "hash": "f441fe06ff9a291297795896d08658a11075629b072989da77ae1091cf4a34df",

		    "raw": \`query TestQuery {
		  friends {
		    ... on User {
		      firstName
		      id
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
		  id
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

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
		                                    "keyRaw": "firstName",
		                                    "visible": true
		                                },

		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id",
		                                    "visible": true
		                                },

		                                "friends": {
		                                    "type": "User",
		                                    "keyRaw": "friends",

		                                    "selection": {
		                                        "fields": {
		                                            "id": {
		                                                "type": "ID",
		                                                "keyRaw": "id",
		                                                "visible": true
		                                            }
		                                        }
		                                    }
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                }
		                            }
		                        },

		                        "typeMap": {}
		                    },

		                    "fields": {
		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename",
		                            "visible": true
		                        }
		                    },

		                    "fragments": {
		                        "A": {
		                            "arguments": {}
		                        }
		                    }
		                },

		                "abstract": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=a113625cc6bf3d5421dc494d07095ea185f1f089c20ede8dfae7fd7e9c37ad4c";
	`)
})

test('selections with interfaces', async function () {
	// the config to use in tests
	const config = testConfig({ module: 'esm' })
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
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "Friends",
		    "kind": "HoudiniQuery",
		    "hash": "dcecf849e85da436e8b2180133c40252b6d0fc236a59d1eda07d2f36e6dc4d7a",

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
		      aka
		    }
		    __typename
		  }
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

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
		                                    "keyRaw": "id",
		                                    "visible": true
		                                },

		                                "owner": {
		                                    "type": "User",
		                                    "keyRaw": "owner",

		                                    "selection": {
		                                        "fields": {
		                                            "firstName": {
		                                                "type": "String",
		                                                "keyRaw": "firstName",
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
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                }
		                            },

		                            "Ghost": {
		                                "name": {
		                                    "type": "String",
		                                    "keyRaw": "name",
		                                    "visible": true
		                                },

		                                "aka": {
		                                    "type": "String",
		                                    "keyRaw": "aka",
		                                    "visible": true
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                }
		                            }
		                        },

		                        "typeMap": {}
		                    },

		                    "fields": {
		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename",
		                            "visible": true
		                        }
		                    }
		                },

		                "abstract": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=09afcd76aca08a3f81221edfb55d165b5241ae8fae5fc1dd42f54f5dec35eb25";
	`)
})

test('selections with unions', async function () {
	// the config to use in tests
	const config = testConfig({ module: 'esm' })
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
	await runPipeline(config, docs)

	// verify contents
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "Friends",
		    "kind": "HoudiniQuery",
		    "hash": "0a67584589a7d0e94bd292830f16677221919367fb88ba6ae1e5d6424a726c34",

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
		      aka
		    }
		    __typename
		  }
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

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
		                                    "keyRaw": "id",
		                                    "visible": true
		                                },

		                                "owner": {
		                                    "type": "User",
		                                    "keyRaw": "owner",

		                                    "selection": {
		                                        "fields": {
		                                            "firstName": {
		                                                "type": "String",
		                                                "keyRaw": "firstName",
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
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                }
		                            },

		                            "Ghost": {
		                                "name": {
		                                    "type": "String",
		                                    "keyRaw": "name",
		                                    "visible": true
		                                },

		                                "aka": {
		                                    "type": "String",
		                                    "keyRaw": "aka",
		                                    "visible": true
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                }
		                            }
		                        },

		                        "typeMap": {}
		                    },

		                    "fields": {
		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename",
		                            "visible": true
		                        }
		                    }
		                },

		                "abstract": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=f11d375eb2ec0b5373b2e717f97a1464c3c2ec470f9b17ad5693c1ff98c9c121";
	`)
})

test('selections with overlapping unions', async function () {
	// the config to use in tests
	const config = testConfig({ module: 'esm' })
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
	await runPipeline(config, docs)

	// verify contents
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "Friends",
		    "kind": "HoudiniQuery",
		    "hash": "0e7538f4f26da448fd586c0b4291d92796407a27ea959c17c018a98933b40e05",

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
		      aka
		    }
		    __typename
		  }
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

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
		                                    "keyRaw": "id",
		                                    "visible": true
		                                },

		                                "owner": {
		                                    "type": "User",
		                                    "keyRaw": "owner",

		                                    "selection": {
		                                        "fields": {
		                                            "firstName": {
		                                                "type": "String",
		                                                "keyRaw": "firstName",
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
		                                },

		                                "name": {
		                                    "type": "String",
		                                    "keyRaw": "name",
		                                    "visible": true
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                }
		                            },

		                            "Ghost": {
		                                "name": {
		                                    "type": "String",
		                                    "keyRaw": "name",
		                                    "visible": true
		                                },

		                                "aka": {
		                                    "type": "String",
		                                    "keyRaw": "aka",
		                                    "visible": true
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                }
		                            }
		                        },

		                        "typeMap": {}
		                    },

		                    "fields": {
		                        "name": {
		                            "type": "String",
		                            "keyRaw": "name",
		                            "visible": true
		                        },

		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename",
		                            "visible": true
		                        }
		                    }
		                },

		                "abstract": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=945820a74a8893f4e526f32809f73f5a1a8cd00e971f9f7ad8c628fa448d1013";
	`)
})

test('selections with unions of abstract types', async function () {
	// the config to use in tests
	const config = testConfig({ module: 'esm' })
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
	await runPipeline(config, docs)

	// verify contents
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "Friends",
		    "kind": "HoudiniQuery",
		    "hash": "a7c039d98e82af7992066b8c4156f82631a0692898ffb07e2788492df0d8f4cb",

		    "raw": \`query Friends {
		  friends {
		    ... on Node {
		      id
		      ... on Cat {
		        owner {
		          firstName
		          id
		        }
		        id
		      }
		    }
		    ... on Ghost {
		      name
		      aka
		    }
		    __typename
		  }
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

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
		                                    "keyRaw": "id",
		                                    "visible": true
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                }
		                            },

		                            "Cat": {
		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id",
		                                    "visible": true
		                                },

		                                "owner": {
		                                    "type": "User",
		                                    "keyRaw": "owner",

		                                    "selection": {
		                                        "fields": {
		                                            "firstName": {
		                                                "type": "String",
		                                                "keyRaw": "firstName",
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
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                }
		                            },

		                            "Ghost": {
		                                "name": {
		                                    "type": "String",
		                                    "keyRaw": "name",
		                                    "visible": true
		                                },

		                                "aka": {
		                                    "type": "String",
		                                    "keyRaw": "aka",
		                                    "visible": true
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
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
		                            "keyRaw": "__typename",
		                            "visible": true
		                        }
		                    }
		                },

		                "abstract": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=80fbad4ae54c0751df3f4036149ac742a7ea00f1a75e3dba813e002de8929902";
	`)
})

test('selections with concrete types matching multiple abstract types', async function () {
	// the config to use in tests
	const config = testConfig({ module: 'esm' })
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
	await runPipeline(config, docs)

	// verify contents
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "Friends",
		    "kind": "HoudiniQuery",
		    "hash": "b1774ca45ffdb6b52e00e2dd2af5247d4e2d7492f85a64baccd90e189b63ab05",

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
		      name
		    }
		    __typename
		  }
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

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
		                                    "keyRaw": "id",
		                                    "visible": true
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                }
		                            },

		                            "Ghost": {
		                                "cats": {
		                                    "type": "Cat",
		                                    "keyRaw": "cats",

		                                    "selection": {
		                                        "fields": {
		                                            "name": {
		                                                "type": "String",
		                                                "keyRaw": "name",
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
		                                },

		                                "aka": {
		                                    "type": "String",
		                                    "keyRaw": "aka",
		                                    "visible": true
		                                },

		                                "name": {
		                                    "type": "String",
		                                    "keyRaw": "name",
		                                    "visible": true
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                }
		                            },

		                            "User": {
		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id",
		                                    "visible": true
		                                },

		                                "cats": {
		                                    "type": "Cat",
		                                    "keyRaw": "cats",

		                                    "selection": {
		                                        "fields": {
		                                            "name": {
		                                                "type": "String",
		                                                "keyRaw": "name",
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
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
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
		                            "keyRaw": "__typename",
		                            "visible": true
		                        }
		                    }
		                },

		                "abstract": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=290263aea02506fe45d2723cf759797c873acb2a577fc1073170f6257b88ad75";
	`)
})

describe('mutation artifacts', function () {
	test('empty operation list', async function () {
		// the config to use in tests
		const config = testConfig({ module: 'esm' })

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
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "B",
			    "kind": "HoudiniMutation",
			    "hash": "d825b44300f0058240504d3b2fba7601dd64077c58219ddb5189faae2033857f",

			    "raw": \`mutation B {
			  addFriend {
			    friend {
			      firstName
			      id
			    }
			  }
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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
			                                        "keyRaw": "firstName",
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

			    "pluginData": {}
			};

			"HoudiniHash=2203fdd50e58f77227a36975144992028bedf3cb08264335f5b3af73913f0b2f";
		`)
	})

	test('insert operation', async function () {
		// the config to use in tests
		const config = testConfig()
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
			    "hash": "d5fae982f620e0988514a4a6e933773a3353743fc94e160c7215bb65f6f89403",

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
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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
			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    },

			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=c2cee63cc2dfd5eabad47ed394b64c91f6e19378bbf018b80c6e3391c3a56e5b";
		`)
	})

	test('insert operation and @with directive', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @with(filter: "Hello World")
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery($filter: String) {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
						field(filter: $filter)
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
			    "hash": "318b26bb1905c0bbca5821e6178aa631994fd44b49490d192a47e8e97b0647e5",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert_1oDy9M
			      id
			    }
			  }
			}

			fragment All_Users_insert_1oDy9M on User {
			  firstName
			  field(filter: "Hello World")
			  id
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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
			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    },

			                                    "field": {
			                                        "type": "String",
			                                        "keyRaw": "field(filter: \\"Hello World\\")",
			                                        "nullable": true
			                                    },

			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {
			                                            "filter": {
			                                                "kind": "StringValue",
			                                                "value": "Hello World"
			                                            }
			                                        }
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

			    "pluginData": {}
			};

			"HoudiniHash=ba51f7673207e362cd0ba18f1dee123fc094a90123d0657b0d56c26d021426df";
		`)
	})

	test('optimsticKey paths', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							id @optimisticKey
						}
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
			    "hash": "97ef3aee607724faacc4b4613fb049b52d28e94227f543c7b394e322eda17ec7",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      id
			    }
			  }
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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
			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",

			                                        "directives": [{
			                                            "name": "optimisticKey",
			                                            "arguments": {}
			                                        }],

			                                        "optimisticKey": true,
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

			    "pluginData": {},
			    "optimisticKeys": true
			};

			"HoudiniHash=78181b23be8762c5db8fd2686b9fed3e8082853857f967e31990ba79350332f4";
		`)
	})

	test('insert operation allList', async function () {
		// the config to use in tests
		const config = testConfig()
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
			    "hash": "d5fae982f620e0988514a4a6e933773a3353743fc94e160c7215bb65f6f89403",

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
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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
			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    },

			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=90d93ca64a69bec0880925b8af471b0da1cf76964df0b6b6c3af30b6fd877217";
		`)
	})

	test('insert operation allList and @with directive', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @with(filter: "Hello World") @allLists
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery($filter: String) {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
						field(filter: $filter)
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
			    "hash": "318b26bb1905c0bbca5821e6178aa631994fd44b49490d192a47e8e97b0647e5",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert_1oDy9M
			      id
			    }
			  }
			}

			fragment All_Users_insert_1oDy9M on User {
			  firstName
			  field(filter: "Hello World")
			  id
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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
			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    },

			                                    "field": {
			                                        "type": "String",
			                                        "keyRaw": "field(filter: \\"Hello World\\")",
			                                        "nullable": true
			                                    },

			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {
			                                            "filter": {
			                                                "kind": "StringValue",
			                                                "value": "Hello World"
			                                            }
			                                        }
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

			    "pluginData": {}
			};

			"HoudiniHash=f6b965893f6a89f0d97c9a63645b36de599756e3e135d8912b1e0b741164caeb";
		`)
	})

	test('remove operation allList', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_remove @allLists
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
			    "hash": "dc1971d8bc597d27220fc2c19d491dc470fd06fedd1308d2130df5c3ffe2f827",

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
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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
			                                "list": "All_Users",
			                                "target": "all"
			                            }],

			                            "selection": {
			                                "fields": {
			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_remove": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=1687548d0889d73e5d143c8e295e0abe989939d22869a86b86d70488209d73d5";
		`)
	})

	test('toggle operation allList', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_toggle @allLists @prepend
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
			    "hash": "14844ea89ea3e888b8d3032c0b579abf637640b1e0de65582ec31e152300cc16",

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
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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
			                                "position": "first",
			                                "target": "all"
			                            }],

			                            "selection": {
			                                "fields": {
			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    },

			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_toggle": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=18243e748112d965c35ee2f2b0e29d430a9c472e30c96f253449296ae3fe636a";
		`)
	})

	test('toggle operation allList and @with directive', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_toggle @with(filter: "Hello World") @allLists @prepend
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery($filter: String) {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
						field(filter: $filter)
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
			    "hash": "bc399504c5fb4a638ea9a13c71f80e17d3c497f711495f5bfd1e57b5061a8303",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_toggle_1oDy9M
			      id
			    }
			  }
			}

			fragment All_Users_toggle_1oDy9M on User {
			  firstName
			  field(filter: "Hello World")
			  id
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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
			                                "position": "first",
			                                "target": "all"
			                            }],

			                            "selection": {
			                                "fields": {
			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    },

			                                    "field": {
			                                        "type": "String",
			                                        "keyRaw": "field(filter: \\"Hello World\\")",
			                                        "nullable": true
			                                    },

			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_toggle": {
			                                        "arguments": {
			                                            "filter": {
			                                                "kind": "StringValue",
			                                                "value": "Hello World"
			                                            }
			                                        }
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

			    "pluginData": {}
			};

			"HoudiniHash=2b2f4aafb54ec3bdba80389398aff1d4b6f478a5e58ec714bb6aa82c48e987b5";
		`)
	})

	test('insert operation allList by default in config', async function () {
		// the config to use in tests
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
			    "hash": "d5fae982f620e0988514a4a6e933773a3353743fc94e160c7215bb65f6f89403",

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
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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
			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    },

			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=c2cee63cc2dfd5eabad47ed394b64c91f6e19378bbf018b80c6e3391c3a56e5b";
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

		// the config to use in tests
		let configUpdate = testConfig()
		configUpdate.internalListPosition = 'first'

		// execute the generator
		await runPipeline(configUpdate, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "d5fae982f620e0988514a4a6e933773a3353743fc94e160c7215bb65f6f89403",

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
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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
			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    },

			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=c2cee63cc2dfd5eabad47ed394b64c91f6e19378bbf018b80c6e3391c3a56e5b";
		`)
	})

	test('toggle operation', async function () {
		// the config to use in tests
		const config = testConfig()
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
			    "hash": "14844ea89ea3e888b8d3032c0b579abf637640b1e0de65582ec31e152300cc16",

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
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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
			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    },

			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_toggle": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=cc9a6fb32e9b6a79e2a3c46885d07b11078f84dcb8c52555fb96e3ff6f87f8b2";
		`)
	})

	test('toggle operation and @with directive', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_toggle @with(filter: "Hello World")
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery($filter: String) {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
						field(filter: $filter)
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
			    "hash": "bc399504c5fb4a638ea9a13c71f80e17d3c497f711495f5bfd1e57b5061a8303",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_toggle_1oDy9M
			      id
			    }
			  }
			}

			fragment All_Users_toggle_1oDy9M on User {
			  firstName
			  field(filter: "Hello World")
			  id
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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
			                                "position": "last"
			                            }],

			                            "selection": {
			                                "fields": {
			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    },

			                                    "field": {
			                                        "type": "String",
			                                        "keyRaw": "field(filter: \\"Hello World\\")",
			                                        "nullable": true
			                                    },

			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_toggle": {
			                                        "arguments": {
			                                            "filter": {
			                                                "kind": "StringValue",
			                                                "value": "Hello World"
			                                            }
			                                        }
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

			    "pluginData": {}
			};

			"HoudiniHash=4a95f1e6dc9fdce153311e84965a99e72f76fc56a063fced1e28efefc50f143a";
		`)
	})

	test('remove operation', async function () {
		// the config to use in tests
		const config = testConfig()
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
			    "hash": "dc1971d8bc597d27220fc2c19d491dc470fd06fedd1308d2130df5c3ffe2f827",

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
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_remove": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=a33810e6e3850879918dc77009577f72a2cab24664911bb0a1e57b47c6b7d104";
		`)
	})

	test('delete operation', async function () {
		// the config to use in tests
		const config = testConfig()
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
			    "hash": "9384d744819f00a9d6ecdcfaba723e90f94dbec1e768bb9a2dd4d11f1d38cab2",

			    "raw": \`mutation A {
			  deleteUser(id: "1234") {
			    userID
			  }
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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

			                            "directives": [{
			                                "name": "User_delete",
			                                "arguments": {}
			                            }],

			                            "operations": [{
			                                "action": "delete",
			                                "type": "User"
			                            }],

			                            "visible": true
			                        }
			                    }
			                },

			                "visible": true
			            }
			        }
			    },

			    "pluginData": {}
			};

			"HoudiniHash=02916c12509a82eb42926c996cc383fde93bc550a72887cd6cf259a1164543da";
		`)
	})

	test('delete operation with condition', async function () {
		// the config to use in tests
		const config = testConfig()
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
			    "hash": "9384d744819f00a9d6ecdcfaba723e90f94dbec1e768bb9a2dd4d11f1d38cab2",

			    "raw": \`mutation A {
			  deleteUser(id: "1234") {
			    userID
			  }
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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

			                            "directives": [{
			                                "name": "User_delete",
			                                "arguments": {}
			                            }, {
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
			                                        "stringValue": "foo"
			                                    }
			                                }
			                            }],

			                            "visible": true
			                        }
			                    }
			                },

			                "visible": true
			            }
			        }
			    },

			    "pluginData": {}
			};

			"HoudiniHash=da85d1acef7d12c0a3185f625a7f77a22a4d2ec90fc91d1a919aefd9209db113";
		`)
	})

	test('parentID - prepend', async function () {
		// the config to use in tests
		const config = testConfig()
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
			    "hash": "d5fae982f620e0988514a4a6e933773a3353743fc94e160c7215bb65f6f89403",

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
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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
			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    },

			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=3bea2bec5d5cac795d941051dbacf5941a18716579f1f63aefb7b898372252d5";
		`)
	})

	test('parentID - append', async function () {
		// the config to use in tests
		const config = testConfig()
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
			    "hash": "d5fae982f620e0988514a4a6e933773a3353743fc94e160c7215bb65f6f89403",

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
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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
			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    },

			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=db83e4480bab1a728042e1da417a3bb1c3acdbe52658847b508d00cf88aa7065";
		`)
	})

	test('parentID - parentID directive', async function () {
		// the config to use in tests
		const config = testConfig()
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
			    "hash": "d5fae982f620e0988514a4a6e933773a3353743fc94e160c7215bb65f6f89403",

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
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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
			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    },

			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=269dd0acb58d7a44b0df6d6a53ed1beaeb5aca5cc216d8011b29425d2eed6584";
		`)
	})

	test('must - prepend', async function () {
		// the config to use in tests
		const config = testConfig()
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
			    "hash": "d5fae982f620e0988514a4a6e933773a3353743fc94e160c7215bb65f6f89403",

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
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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
			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    },

			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=5bbd672c18c5febf61cf8335145d6f837b1e711ec3f1a1d5b81241767444c8ed";
		`)
	})

	test('must - append', async function () {
		// the config to use in tests
		const config = testConfig()
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
			    "hash": "d5fae982f620e0988514a4a6e933773a3353743fc94e160c7215bb65f6f89403",

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
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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
			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    },

			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=8b57b4d6231aeadc73661b6096f815d1f59fa9bb44e62b363d72c7dfcd78048f";
		`)
	})

	test('must - directive', async function () {
		// the config to use in tests
		const config = testConfig()
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
			    "hash": "d5fae982f620e0988514a4a6e933773a3353743fc94e160c7215bb65f6f89403",

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
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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
			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    },

			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=c6990945263aa9f52111e9cc0d89b6ccad2a258ca5356f6cf23a7e9424354aa7";
		`)
	})

	test('must_not - prepend', async function () {
		// the config to use in tests
		const config = testConfig()
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
			    "hash": "d5fae982f620e0988514a4a6e933773a3353743fc94e160c7215bb65f6f89403",

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
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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
			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    },

			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=d7fca173168e1a7c842115c468d62ff9d347724c0a8fa20a3408771eef5c7cf9";
		`)
	})

	test('must_not - append', async function () {
		// the config to use in tests
		const config = testConfig()
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
			    "hash": "d5fae982f620e0988514a4a6e933773a3353743fc94e160c7215bb65f6f89403",

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
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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
			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    },

			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=cc5ca165e8418fe5ac352c3067402d6aca3c1e76c25efdad5d076dbf294e2554";
		`)
	})

	test('list filters', async function () {
		// the config to use in tests
		const config = testConfig()
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
			    "hash": "9213bfe3e00205983f14587d49ffda87d7ca30c44371c8e6aa0f38f399d84f37",

			    "raw": \`query TestQuery($value: String!) {
			  users(stringValue: $value, boolValue: true, floatValue: 1.2, intValue: 1) {
			    firstName
			    id
			  }
			}\`,

			    "rootType": "Query",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "users": {
			                "type": "User",
			                "keyRaw": "users(boolValue: true, floatValue: 1.2, intValue: 1, stringValue: $value)",

			                "directives": [{
			                    "name": "list",

			                    "arguments": {
			                        "name": {
			                            "kind": "StringValue",
			                            "value": "All_Users"
			                        }
			                    }
			                }],

			                "list": {
			                    "name": "All_Users",
			                    "connection": false,
			                    "type": "User"
			                },

			                "selection": {
			                    "fields": {
			                        "firstName": {
			                            "type": "String",
			                            "keyRaw": "firstName",
			                            "visible": true
			                        },

			                        "id": {
			                            "type": "ID",
			                            "keyRaw": "id",
			                            "visible": true
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
			                },

			                "visible": true
			            }
			        }
			    },

			    "pluginData": {},

			    "input": {
			        "fields": {
			            "value": "String"
			        },

			        "types": {},
			        "defaults": {},
			        "runtimeScalars": {}
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=f0b0082b38e66bc9fcefcd11741b874cacb74a1a939221c1618b499df139b356";
		`)
	})

	test('must_not - directive', async function () {
		// the config to use in tests
		const config = testConfig()
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
			    "hash": "d5fae982f620e0988514a4a6e933773a3353743fc94e160c7215bb65f6f89403",

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
			}\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

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
			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    },

			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=a29794de026215f4e9266358741cf0ab3876640e1230e3dc190907d5cc7c1c37";
		`)
	})

	test('tracks list name', async function () {
		// the config to use in tests
		const config = testConfig()
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
			    "hash": "a3b6fe4ebea2be126d176bfea5fc42b306ed0d9e663da6fb8d9617efd3125a2b",

			    "raw": \`query TestQuery {
			  users(stringValue: "foo") {
			    firstName
			    id
			  }
			}\`,

			    "rootType": "Query",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "users": {
			                "type": "User",
			                "keyRaw": "users(stringValue: \\"foo\\")",

			                "directives": [{
			                    "name": "list",

			                    "arguments": {
			                        "name": {
			                            "kind": "StringValue",
			                            "value": "All_Users"
			                        }
			                    }
			                }],

			                "list": {
			                    "name": "All_Users",
			                    "connection": false,
			                    "type": "User"
			                },

			                "selection": {
			                    "fields": {
			                        "firstName": {
			                            "type": "String",
			                            "keyRaw": "firstName",
			                            "visible": true
			                        },

			                        "id": {
			                            "type": "ID",
			                            "keyRaw": "id",
			                            "visible": true
			                        }
			                    }
			                },

			                "filters": {
			                    "stringValue": {
			                        "kind": "String",
			                        "value": "foo"
			                    }
			                },

			                "visible": true
			            }
			        }
			    },

			    "pluginData": {},
			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=85351c80364eb41f7eae70628dd67dedfc2057a39ef3967c9e9b739e568b0f42";
		`)
	})

	test('tracks paginate name', async function () {
		// the config to use in tests
		const config = testConfig()
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
			    "hash": "fff1b6c02ba485174642e4b721aed9d180f4784d0039ed6b8a98d0f838d7dbcf",

			    "refetch": {
			        "path": ["usersByCursor"],
			        "method": "cursor",
			        "pageSize": 10,
			        "embedded": false,
			        "targetType": "Query",
			        "paginated": true,
			        "direction": "both",
			        "mode": "Infinite"
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
			}\`,

			    "rootType": "Query",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "usersByCursor": {
			                "type": "UserConnection",
			                "keyRaw": "usersByCursor::paginated",

			                "directives": [{
			                    "name": "paginate",

			                    "arguments": {
			                        "name": {
			                            "kind": "StringValue",
			                            "value": "All_Users"
			                        },

			                        "connection": {
			                            "kind": "BooleanValue",
			                            "value": true
			                        }
			                    }
			                }],

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
			                                                    "keyRaw": "firstName",
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
			            "after": "String",
			            "last": "Int",
			            "before": "String"
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

			"HoudiniHash=9aec53bb0325a811ba8adfc41b04524f0ed859aa1b0f9d5e04d4bc02f639e52f";
		`)
	})

	test('tracks paginate mode', async function () {
		const config = testConfig()

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
					usersByCursor(first: 10) @paginate(name: "All_Users", mode: SinglePage) {
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
			    "hash": "fff1b6c02ba485174642e4b721aed9d180f4784d0039ed6b8a98d0f838d7dbcf",

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
			}\`,

			    "rootType": "Query",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "usersByCursor": {
			                "type": "UserConnection",
			                "keyRaw": "usersByCursor(after: $after, before: $before, first: $first, last: $last)::paginated",

			                "directives": [{
			                    "name": "paginate",

			                    "arguments": {
			                        "name": {
			                            "kind": "StringValue",
			                            "value": "All_Users"
			                        },

			                        "mode": {
			                            "kind": "EnumValue",
			                            "value": "SinglePage"
			                        },

			                        "connection": {
			                            "kind": "BooleanValue",
			                            "value": true
			                        }
			                    }
			                }],

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
			                                                    "keyRaw": "firstName",
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
			            "after": "String",
			            "last": "Int",
			            "before": "String"
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

			"HoudiniHash=930593f99a19ddef0943d66ce3c4539f18938a25410028bfd4cf68554552f1d0";
		`)
	})

	test('field args', async function () {
		// the config to use in tests
		const config = testConfig()
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
			    "hash": "9213bfe3e00205983f14587d49ffda87d7ca30c44371c8e6aa0f38f399d84f37",

			    "raw": \`query TestQuery($value: String!) {
			  users(stringValue: $value, boolValue: true, floatValue: 1.2, intValue: 1) {
			    firstName
			    id
			  }
			}\`,

			    "rootType": "Query",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "users": {
			                "type": "User",
			                "keyRaw": "users(boolValue: true, floatValue: 1.2, intValue: 1, stringValue: $value)",

			                "directives": [{
			                    "name": "list",

			                    "arguments": {
			                        "name": {
			                            "kind": "StringValue",
			                            "value": "All_Users"
			                        }
			                    }
			                }],

			                "list": {
			                    "name": "All_Users",
			                    "connection": false,
			                    "type": "User"
			                },

			                "selection": {
			                    "fields": {
			                        "firstName": {
			                            "type": "String",
			                            "keyRaw": "firstName",
			                            "visible": true
			                        },

			                        "id": {
			                            "type": "ID",
			                            "keyRaw": "id",
			                            "visible": true
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
			                },

			                "visible": true
			            }
			        }
			    },

			    "pluginData": {},

			    "input": {
			        "fields": {
			            "value": "String"
			        },

			        "types": {},
			        "defaults": {},
			        "runtimeScalars": {}
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=f0b0082b38e66bc9fcefcd11741b874cacb74a1a939221c1618b499df139b356";
		`)
	})

	test('sveltekit', async function () {
		// the config to use in tests
		const config = testConfig({ module: 'esm' })

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
			    "hash": "9213bfe3e00205983f14587d49ffda87d7ca30c44371c8e6aa0f38f399d84f37",

			    "raw": \`query TestQuery($value: String!) {
			  users(stringValue: $value, boolValue: true, floatValue: 1.2, intValue: 1) {
			    firstName
			    id
			  }
			}\`,

			    "rootType": "Query",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "users": {
			                "type": "User",
			                "keyRaw": "users(boolValue: true, floatValue: 1.2, intValue: 1, stringValue: $value)",

			                "directives": [{
			                    "name": "list",

			                    "arguments": {
			                        "name": {
			                            "kind": "StringValue",
			                            "value": "All_Users"
			                        }
			                    }
			                }],

			                "list": {
			                    "name": "All_Users",
			                    "connection": false,
			                    "type": "User"
			                },

			                "selection": {
			                    "fields": {
			                        "firstName": {
			                            "type": "String",
			                            "keyRaw": "firstName",
			                            "visible": true
			                        },

			                        "id": {
			                            "type": "ID",
			                            "keyRaw": "id",
			                            "visible": true
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
			                },

			                "visible": true
			            }
			        }
			    },

			    "pluginData": {},

			    "input": {
			        "fields": {
			            "value": "String"
			        },

			        "types": {},
			        "defaults": {},
			        "runtimeScalars": {}
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=f0b0082b38e66bc9fcefcd11741b874cacb74a1a939221c1618b499df139b356";
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
		    "hash": "6d3b1197489ec6ad1bacd3dc77ab79b1f075d373c8923be2f2e96b27ab8a7dce",

		    "raw": \`query TestQuery {
		  allItems {
		    createdAt
		  }
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "allItems": {
		                "type": "TodoItem",
		                "keyRaw": "allItems",

		                "selection": {
		                    "fields": {
		                        "createdAt": {
		                            "type": "DateTime",
		                            "keyRaw": "createdAt",
		                            "visible": true
		                        }
		                    }
		                },

		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=5eb3e999f486aba5c66170642f3d99537b7c17d793a9d8553533e3d949860213";
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
		    "hash": "014c7791d749b2fce0a8d6d30d191fac3b37d4bbbf4b075322cb5ca9dbe09ba1",

		    "raw": \`query TestQuery($id: ID, $filter: UserFilter, $filterList: [UserFilter!], $enumArg: MyEnum) {
		  user(id: $id, filter: $filter, filterList: $filterList, enumArg: $enumArg) {
		    id
		  }
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

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
		        },

		        "defaults": {},
		        "runtimeScalars": {}
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=88c4ba560cbbe391ebfa655630a896a1a9933408dd8d20be26cf6685a2089a5a";
	`)
})

describe('subscription artifacts', function () {
	test('happy path', async function () {
		// the config to use in tests
		const config = testConfig()
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
			    "hash": "421342a4a75c97ffbfb125e3dcf06cec1cea593be1bf1c774e1038c3ed363d91",

			    "raw": \`subscription B {
			  newUser {
			    user {
			      firstName
			      id
			    }
			  }
			}\`,

			    "rootType": "Subscription",
			    "stripVariables": [],

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
			                                        "keyRaw": "firstName",
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

			    "pluginData": {}
			};

			"HoudiniHash=df5bc6be33a8a16e9353ff30c07e45d5e54531ab53157208255fdfec52c7b168";
		`)
	})
})

test('some artifactData added to artifact specific to plugins', async function () {
	// the config to use in tests
	const localConfig = testConfig()

	localConfig.plugins = [
		{
			name: 'plugin-tmp1',
			filepath: '',
			artifactData: () => {
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
	await runPipeline(localConfig, docs)

	// load the contents of the file
	// We should have nothing related to plugin-tmp2
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestQuery",
		    "kind": "HoudiniQuery",
		    "hash": "24015ccbaa62e80c1a1364e01cf181591c9fbb03da6a9b32da97fb23f820ff78",

		    "raw": \`query TestQuery {
		  version
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "version": {
		                "type": "Int",
		                "keyRaw": "version",
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {
		        "plugin-tmp1": {
		            "added_stuff": {
		                "yop": "true"
		            }
		        }
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=4e7afee5e8aa689ee7f58f61f60955769c29fe630b05a32ca2a5d8f61620afe3";
	`)
})

test('nested recursive fragments', async function () {
	// the config to use in tests
	const config = testConfig()
	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`
			query MyAnimalQuery {
				node(id: "some_id") {
					id

					...NodeDetails

					... on User {
						...UserThings
					}
				}
			}
		`),
		mockCollectedDoc(`
			fragment UserThings on User {
				id
				name

				...NodeDetails
			}
		`),
		mockCollectedDoc(`
			fragment NodeDetails on Node {
				id

				... on User {
					id
				}
			}
		`),
	]

	// execute the generator
	await runPipeline(config, docs)
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "MyAnimalQuery",
		    "kind": "HoudiniQuery",
		    "hash": "c7875d1ffb00d945ee1f8be61e3f75b8dc3d31e47a3f9d4c6bf84569bf1a4c1b",

		    "raw": \`query MyAnimalQuery {
		  node(id: "some_id") {
		    id
		    ...NodeDetails
		    ... on User {
		      ...UserThings
		      id
		    }
		    __typename
		  }
		}

		fragment NodeDetails on Node {
		  id
		  ... on User {
		    id
		  }
		  __typename
		}

		fragment UserThings on User {
		  id
		  name
		  ...NodeDetails
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "node": {
		                "type": "Node",
		                "keyRaw": "node(id: \\"some_id\\")",
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
		                    },

		                    "abstractFields": {
		                        "fields": {
		                            "User": {
		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id",
		                                    "visible": true
		                                },

		                                "name": {
		                                    "type": "String",
		                                    "keyRaw": "name"
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                }
		                            }
		                        },

		                        "typeMap": {}
		                    },

		                    "fragments": {
		                        "NodeDetails": {
		                            "arguments": {}
		                        },

		                        "UserThings": {
		                            "arguments": {}
		                        }
		                    }
		                },

		                "abstract": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=5bffb5d88b4646c49637e5f92f601ee632823009b7bf5fdfafb1f107b5fc35cd";
	`)
})

test('leave @include and @skip alone', async function () {
	// the config to use in tests
	const config = testConfig()
	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`
			query MyAnimalQuery {
				node(id: "some_id") {
					id @skip(if: true)

					...NodeDetails @include(if:true)
				}
			}
		`),
		mockCollectedDoc(`
			fragment NodeDetails on Node {
				id

				... on User {
					id
				}
			}
		`),
	]

	// execute the generator
	await runPipeline(config, docs)
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "MyAnimalQuery",
		    "kind": "HoudiniQuery",
		    "hash": "3ad0fff0ad120f72fd351b46d075a19fc4a7e1c5d1d1d4733dfcc9d26043fcf3",

		    "raw": \`query MyAnimalQuery {
		  node(id: "some_id") {
		    id @skip(if: true)
		    ...NodeDetails @include(if: true)
		    __typename
		  }
		}

		fragment NodeDetails on Node {
		  id
		  ... on User {
		    id
		  }
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "node": {
		                "type": "Node",
		                "keyRaw": "node(id: \\"some_id\\")",
		                "nullable": true,

		                "selection": {
		                    "fields": {
		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id",
		                            "visible": true,

		                            "directives": [{
		                                "name": "skip",

		                                "arguments": {
		                                    "if": {
		                                        "kind": "BooleanValue",
		                                        "value": true
		                                    }
		                                }
		                            }]
		                        },

		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename",
		                            "visible": true
		                        }
		                    },

		                    "abstractFields": {
		                        "fields": {
		                            "User": {
		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id",
		                                    "visible": true,

		                                    "directives": [{
		                                        "name": "skip",

		                                        "arguments": {
		                                            "if": {
		                                                "kind": "BooleanValue",
		                                                "value": true
		                                            }
		                                        }
		                                    }]
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                }
		                            }
		                        },

		                        "typeMap": {}
		                    },

		                    "fragments": {
		                        "NodeDetails": {
		                            "arguments": {}
		                        }
		                    }
		                },

		                "abstract": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=45c8890ba76a34c30028cbaa75e8ba78ca8884a3651a5c1f77d103969eff5855";
	`)
})

test('fragment references are embedded in artifact', async function () {
	// the config to use in tests
	const config = testConfig()
	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`
			query MyAnimalQuery {
				node(id: "some_id") {
					id

					...NodeDetails

				}
			}
		`),
		mockCollectedDoc(`
			fragment NodeDetails on Node {
				id

				... on User {
					id
				}
			}
		`),
	]

	// execute the generator
	await runPipeline(config, docs)
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "MyAnimalQuery",
		    "kind": "HoudiniQuery",
		    "hash": "30a325b2371ac4a2a16be758f85fe34299392d05e521a2a9b22ddda009333904",

		    "raw": \`query MyAnimalQuery {
		  node(id: "some_id") {
		    id
		    ...NodeDetails
		    __typename
		  }
		}

		fragment NodeDetails on Node {
		  id
		  ... on User {
		    id
		  }
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "node": {
		                "type": "Node",
		                "keyRaw": "node(id: \\"some_id\\")",
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
		                    },

		                    "abstractFields": {
		                        "fields": {
		                            "User": {
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

		                        "typeMap": {}
		                    },

		                    "fragments": {
		                        "NodeDetails": {
		                            "arguments": {}
		                        }
		                    }
		                },

		                "abstract": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=3756d5c29fa6c05ef3636a9ccaf165e6f7800cc5d91d7faf40f51c8bb1a73f57";
	`)
})

test('fragment variables are embedded in artifact', async function () {
	// the config to use in tests
	const config = testConfig()
	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`
			query MyAnimalQuery {
				node(id: "some_id") {
					id
					...NodeDetails @with(name: "Foo")

				}
			}
		`),
		mockCollectedDoc(`
			fragment NodeDetails on Node @arguments(name: { type: "String" }){
				... on User {
					field(filter: $name)
				}
			}
		`),
	]

	// execute the generator
	await runPipeline(config, docs)
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "MyAnimalQuery",
		    "kind": "HoudiniQuery",
		    "hash": "d27693a0f8b25386667d938e07f2251eec0f04260bd155a715c90911cc94e930",

		    "raw": \`query MyAnimalQuery {
		  node(id: "some_id") {
		    id
		    ...NodeDetails_32RKor
		    __typename
		  }
		}

		fragment NodeDetails_32RKor on Node {
		  ... on User {
		    field(filter: "Foo")
		    id
		  }
		  id
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "node": {
		                "type": "Node",
		                "keyRaw": "node(id: \\"some_id\\")",
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
		                    },

		                    "abstractFields": {
		                        "fields": {
		                            "User": {
		                                "field": {
		                                    "type": "String",
		                                    "keyRaw": "field(filter: \\"Foo\\")",
		                                    "nullable": true
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

		                        "typeMap": {}
		                    },

		                    "fragments": {
		                        "NodeDetails": {
		                            "arguments": {
		                                "name": {
		                                    "kind": "StringValue",
		                                    "value": "Foo"
		                                }
		                            }
		                        }
		                    }
		                },

		                "abstract": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=444c42cc7214c06f0976b8a252e4f1c1fcba074d1afc1543acf0fc88f56e4f31";
	`)
})

test('fragment nested in root', async function () {
	// the config to use in tests
	const config = testConfig()
	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`
			fragment UserBase on User {
				id
				firstName
				...UserMore
			}
		`),
		mockCollectedDoc(`
			fragment UserMore on User {
				id
				firstName
			}
		`),
	]

	// execute the generator
	await runPipeline(config, docs)
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "UserBase",
		    "kind": "HoudiniFragment",
		    "hash": "9b42e711c6a2c6963081878055088332491c172b2d746036a355db2d148fc1eb",

		    "raw": \`fragment UserBase on User {
		  id
		  firstName
		  ...UserMore
		  __typename
		}

		fragment UserMore on User {
		  id
		  firstName
		  __typename
		}\`,

		    "rootType": "User",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "id": {
		                "type": "ID",
		                "keyRaw": "id",
		                "visible": true
		            },

		            "firstName": {
		                "type": "String",
		                "keyRaw": "firstName",
		                "visible": true
		            },

		            "__typename": {
		                "type": "String",
		                "keyRaw": "__typename",
		                "visible": true
		            }
		        },

		        "fragments": {
		            "UserMore": {
		                "arguments": {}
		            }
		        }
		    },

		    "pluginData": {}
		};

		"HoudiniHash=05ec5090d31f77c3f2bdcbd26aff116588f63d4b3789ae752759dd172974a628";
	`)
})

test('client nullability', async function () {
	// the config to use in tests
	const config = testConfig()

	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`
			query TestQuery($id: ID!) {
				node(id: $id) {
					...LegendWithRequiredName
					...GhostWithRequiredLegendName
					...GhostWithRequiredLegendAndLegendName
				}
			}
		`),
		mockCollectedDoc(`
			fragment LegendWithRequiredName on Legend {
				name @required
			}
		`),
		mockCollectedDoc(`
			fragment GhostWithRequiredLegendName on Ghost {
				legends {
					name @required
				}
			}
		`),
		mockCollectedDoc(`
			fragment GhostWithRequiredLegendAndLegendName on Ghost {
				legends @required {
					name @required
				}
			}
		`),
	]

	// execute the generator
	await runPipeline(config, docs)
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestQuery",
		    "kind": "HoudiniQuery",
		    "hash": "5b7b9615dce42b0673a170ba8e51068ebd7ddfed66cc996474da42ac1c92bf6f",

		    "raw": \`query TestQuery($id: ID!) {
		  node(id: $id) {
		    ...LegendWithRequiredName
		    ...GhostWithRequiredLegendName
		    ...GhostWithRequiredLegendAndLegendName
		    id
		    __typename
		  }
		}

		fragment LegendWithRequiredName on Legend {
		  name
		  __typename
		}

		fragment GhostWithRequiredLegendName on Ghost {
		  legends {
		    name
		  }
		  name
		  aka
		  __typename
		}

		fragment GhostWithRequiredLegendAndLegendName on Ghost {
		  legends {
		    name
		  }
		  name
		  aka
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "node": {
		                "type": "Node",
		                "keyRaw": "node(id: $id)",
		                "nullable": true,

		                "selection": {
		                    "abstractFields": {
		                        "fields": {
		                            "Legend": {
		                                "name": {
		                                    "type": "String",
		                                    "keyRaw": "name",

		                                    "directives": [{
		                                        "name": "required",
		                                        "arguments": {}
		                                    }],

		                                    "nullable": false,
		                                    "required": true
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                },

		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id",
		                                    "visible": true
		                                }
		                            },

		                            "Ghost": {
		                                "legends": {
		                                    "type": "Legend",
		                                    "keyRaw": "legends",

		                                    "selection": {
		                                        "fields": {
		                                            "name": {
		                                                "type": "String",
		                                                "keyRaw": "name",

		                                                "directives": [{
		                                                    "name": "required",
		                                                    "arguments": {}
		                                                }],

		                                                "nullable": false,
		                                                "required": true
		                                            }
		                                        }
		                                    },

		                                    "nullable": true
		                                },

		                                "name": {
		                                    "type": "String",
		                                    "keyRaw": "name",
		                                    "visible": true
		                                },

		                                "aka": {
		                                    "type": "String",
		                                    "keyRaw": "aka",
		                                    "visible": true
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                },

		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id",
		                                    "visible": true
		                                }
		                            }
		                        },

		                        "typeMap": {}
		                    },

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
		                    },

		                    "fragments": {
		                        "LegendWithRequiredName": {
		                            "arguments": {}
		                        },

		                        "GhostWithRequiredLegendName": {
		                            "arguments": {}
		                        },

		                        "GhostWithRequiredLegendAndLegendName": {
		                            "arguments": {}
		                        }
		                    }
		                },

		                "abstract": true,
		                "abstractHasRequired": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},

		    "input": {
		        "fields": {
		            "id": "ID"
		        },

		        "types": {},
		        "defaults": {},
		        "runtimeScalars": {}
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=23216f6c7d045549667f3a1d5b156fe3924abc3cd1bbce9cfdcbc3394da6065c";
	`)
})

test('nested abstract fragment on connection', async function () {
	// the config to use in tests
	const config = testConfig()

	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`
			query AnimalQuery {
				animals {
					pageInfo {
					  hasPreviousPage
					  hasNextPage
					  startCursor
					  endCursor
					}
					...MonkeyList
				}
			}
		`),
		mockCollectedDoc(`
			fragment MonkeyList on MonkeyConnection {
				edges {
					node {
						hasBanana
					}
				}
				...AnimalList
			}
		`),
		mockCollectedDoc(`
			fragment AnimalList on AnimalConnection {
				edges {
					node {
						id
						...AnimalProps
					}
				}
			}
		`),
		mockCollectedDoc(`
			fragment AnimalProps on Animal {
				name
			}
		`),
	]

	await runPipeline(config, docs)
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "AnimalQuery",
		    "kind": "HoudiniQuery",
		    "hash": "be1baabd9718fc3324dd82833c6f9cfbecbb566ee935baaa00d632c828207837",

		    "raw": \`query AnimalQuery {
		  animals {
		    pageInfo {
		      hasPreviousPage
		      hasNextPage
		      startCursor
		      endCursor
		    }
		    ...MonkeyList
		    __typename
		  }
		}

		fragment MonkeyList on MonkeyConnection {
		  edges {
		    node {
		      hasBanana
		      id
		    }
		  }
		  ...AnimalList
		  __typename
		}

		fragment AnimalList on AnimalConnection {
		  edges {
		    node {
		      id
		      ...AnimalProps
		      __typename
		    }
		    __typename
		  }
		  __typename
		}

		fragment AnimalProps on Animal {
		  name
		  id
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "animals": {
		                "type": "AnimalConnection",
		                "keyRaw": "animals",
		                "nullable": true,

		                "selection": {
		                    "abstractFields": {
		                        "fields": {
		                            "MonkeyConnection": {
		                                "edges": {
		                                    "type": "AnimalEdge",
		                                    "keyRaw": "edges",

		                                    "selection": {
		                                        "fields": {
		                                            "node": {
		                                                "type": "Animal",
		                                                "keyRaw": "node",
		                                                "nullable": true,

		                                                "selection": {
		                                                    "fields": {
		                                                        "hasBanana": {
		                                                            "type": "Boolean",
		                                                            "keyRaw": "hasBanana"
		                                                        },

		                                                        "id": {
		                                                            "type": "ID",
		                                                            "keyRaw": "id",
		                                                            "visible": true
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

		                                                    "fragments": {
		                                                        "AnimalProps": {
		                                                            "arguments": {}
		                                                        }
		                                                    }
		                                                },

		                                                "abstract": true
		                                            },

		                                            "__typename": {
		                                                "type": "String",
		                                                "keyRaw": "__typename"
		                                            }
		                                        }
		                                    },

		                                    "abstract": true
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
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
		                                                "visible": true
		                                            },

		                                            "hasNextPage": {
		                                                "type": "Boolean",
		                                                "keyRaw": "hasNextPage",
		                                                "visible": true
		                                            },

		                                            "startCursor": {
		                                                "type": "String",
		                                                "keyRaw": "startCursor",
		                                                "visible": true
		                                            },

		                                            "endCursor": {
		                                                "type": "String",
		                                                "keyRaw": "endCursor",
		                                                "visible": true
		                                            }
		                                        }
		                                    },

		                                    "visible": true
		                                }
		                            }
		                        },

		                        "typeMap": {}
		                    },

		                    "fields": {
		                        "edges": {
		                            "type": "AnimalEdge",
		                            "keyRaw": "edges",

		                            "selection": {
		                                "fields": {
		                                    "node": {
		                                        "type": "Animal",
		                                        "keyRaw": "node",
		                                        "nullable": true,

		                                        "selection": {
		                                            "fields": {
		                                                "name": {
		                                                    "type": "String",
		                                                    "keyRaw": "name"
		                                                },

		                                                "id": {
		                                                    "type": "ID",
		                                                    "keyRaw": "id",
		                                                    "visible": true
		                                                },

		                                                "__typename": {
		                                                    "type": "String",
		                                                    "keyRaw": "__typename"
		                                                }
		                                            },

		                                            "fragments": {
		                                                "AnimalProps": {
		                                                    "arguments": {}
		                                                }
		                                            }
		                                        },

		                                        "abstract": true
		                                    },

		                                    "__typename": {
		                                        "type": "String",
		                                        "keyRaw": "__typename"
		                                    }
		                                }
		                            },

		                            "abstract": true
		                        },

		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename",
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
		                                        "visible": true
		                                    },

		                                    "hasNextPage": {
		                                        "type": "Boolean",
		                                        "keyRaw": "hasNextPage",
		                                        "visible": true
		                                    },

		                                    "startCursor": {
		                                        "type": "String",
		                                        "keyRaw": "startCursor",
		                                        "visible": true
		                                    },

		                                    "endCursor": {
		                                        "type": "String",
		                                        "keyRaw": "endCursor",
		                                        "visible": true
		                                    }
		                                }
		                            },

		                            "visible": true
		                        }
		                    },

		                    "fragments": {
		                        "MonkeyList": {
		                            "arguments": {}
		                        },

		                        "AnimalList": {
		                            "arguments": {}
		                        }
		                    }
		                },

		                "abstract": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=5ffbbc9f49c89384d57cfdc0eda0fe097d251b216c6958707226dfa1090c454f";
	`)
})

test('nested abstract fragments', async function () {
	// the config to use in tests
	const config = testConfig()

	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`
			query AnimalsOverview {
				animals {
					...AnimalsOverviewList
				}
			}
		`),
		mockCollectedDoc(`
			fragment AnimalsOverviewList on AnimalConnection {
				edges {
					node {
						... on Monkey {
							...MonkeyFragment
						}
					}
				}
			}
		`),
		mockCollectedDoc(`
			fragment MonkeyFragment on Monkey {
				id
				name
				hasBanana
			}
		`),
	]

	await runPipeline(config, docs)
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "AnimalsOverview",
		    "kind": "HoudiniQuery",
		    "hash": "e08561197422d2657a5d55a8a37f1f1312df225a4966c59a0c6c043fa113e138",

		    "raw": \`query AnimalsOverview {
		  animals {
		    ...AnimalsOverviewList
		    __typename
		  }
		}

		fragment AnimalsOverviewList on AnimalConnection {
		  edges {
		    node {
		      ... on Monkey {
		        ...MonkeyFragment
		        id
		      }
		      id
		      __typename
		    }
		    __typename
		  }
		  __typename
		}

		fragment MonkeyFragment on Monkey {
		  id
		  name
		  hasBanana
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "animals": {
		                "type": "AnimalConnection",
		                "keyRaw": "animals",
		                "nullable": true,

		                "selection": {
		                    "fields": {
		                        "edges": {
		                            "type": "AnimalEdge",
		                            "keyRaw": "edges",

		                            "selection": {
		                                "fields": {
		                                    "node": {
		                                        "type": "Animal",
		                                        "keyRaw": "node",
		                                        "nullable": true,

		                                        "selection": {
		                                            "abstractFields": {
		                                                "fields": {
		                                                    "Monkey": {
		                                                        "id": {
		                                                            "type": "ID",
		                                                            "keyRaw": "id",
		                                                            "visible": true
		                                                        },

		                                                        "name": {
		                                                            "type": "String",
		                                                            "keyRaw": "name"
		                                                        },

		                                                        "hasBanana": {
		                                                            "type": "Boolean",
		                                                            "keyRaw": "hasBanana"
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
		                                                "id": {
		                                                    "type": "ID",
		                                                    "keyRaw": "id",
		                                                    "visible": true
		                                                },

		                                                "__typename": {
		                                                    "type": "String",
		                                                    "keyRaw": "__typename"
		                                                }
		                                            },

		                                            "fragments": {
		                                                "MonkeyFragment": {
		                                                    "arguments": {}
		                                                }
		                                            }
		                                        },

		                                        "abstract": true
		                                    },

		                                    "__typename": {
		                                        "type": "String",
		                                        "keyRaw": "__typename"
		                                    }
		                                }
		                            },

		                            "abstract": true
		                        },

		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename",
		                            "visible": true
		                        }
		                    },

		                    "fragments": {
		                        "AnimalsOverviewList": {
		                            "arguments": {}
		                        }
		                    }
		                },

		                "abstract": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=76b03979f7da0a69d5fbf2aa80f2ff7610168ec74b7545b16344b1e37deca9d2";
	`)

	expect(docs[1]).toMatchInlineSnapshot(`
		export default {
		    "name": "AnimalsOverviewList",
		    "kind": "HoudiniFragment",
		    "hash": "d8ddbc0f31565ad88289ee2054b7f4f0718fc573d435d470c4fe1d89be65bdb9",

		    "raw": \`fragment AnimalsOverviewList on AnimalConnection {
		  edges {
		    node {
		      ... on Monkey {
		        ...MonkeyFragment
		        id
		      }
		      id
		      __typename
		    }
		    __typename
		  }
		  __typename
		}

		fragment MonkeyFragment on Monkey {
		  id
		  name
		  hasBanana
		  __typename
		}\`,

		    "rootType": "AnimalConnection",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "edges": {
		                "type": "AnimalEdge",
		                "keyRaw": "edges",

		                "selection": {
		                    "fields": {
		                        "node": {
		                            "type": "Animal",
		                            "keyRaw": "node",
		                            "nullable": true,

		                            "selection": {
		                                "abstractFields": {
		                                    "fields": {
		                                        "Monkey": {
		                                            "id": {
		                                                "type": "ID",
		                                                "keyRaw": "id",
		                                                "visible": true
		                                            },

		                                            "name": {
		                                                "type": "String",
		                                                "keyRaw": "name"
		                                            },

		                                            "hasBanana": {
		                                                "type": "Boolean",
		                                                "keyRaw": "hasBanana"
		                                            },

		                                            "__typename": {
		                                                "type": "String",
		                                                "keyRaw": "__typename",
		                                                "visible": true
		                                            }
		                                        }
		                                    },

		                                    "typeMap": {}
		                                },

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
		                                },

		                                "fragments": {
		                                    "MonkeyFragment": {
		                                        "arguments": {}
		                                    }
		                                }
		                            },

		                            "abstract": true,
		                            "visible": true
		                        },

		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename",
		                            "visible": true
		                        }
		                    }
		                },

		                "abstract": true,
		                "visible": true
		            },

		            "__typename": {
		                "type": "String",
		                "keyRaw": "__typename",
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {}
		};

		"HoudiniHash=72091e952cf94a18193cee6cda1caf256f6439e4e202b319d876e9b3365ac319";
	`)
})

test('runtimeScalars', async function () {
	// the config to use in tests
	const config = testConfig()

	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`
			query AnimalsOverview($id: ViewerIDFromSession!) {
				node(id: $id) {
					id
				}
			}
		`),
	]

	await runPipeline(config, docs)

	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "AnimalsOverview",
		    "kind": "HoudiniQuery",
		    "hash": "97a70b7b377be64692fb480eab7a205ddd6f5fde8b3f941e5ba6cfc84d9ca991",

		    "raw": \`query AnimalsOverview($id: ID!) {
		  node(id: $id) {
		    id
		    __typename
		  }
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "node": {
		                "type": "Node",
		                "keyRaw": "node(id: $id)",
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

		                "abstract": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},

		    "input": {
		        "fields": {
		            "id": "ID"
		        },

		        "types": {},
		        "defaults": {},

		        "runtimeScalars": {
		            "id": "ViewerIDFromSession"
		        }
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=df81d1ede64bedbd8a57467683fe68a9366e29a2ed240465ad0c8a9cb4302242";
	`)
})

describe('default arguments', function () {
	test('adds default values to the artifact', async function () {
		// the config to use in tests
		const config = testConfig()
		// the documents to test
		const docs: Document[] = [
			mockCollectedDoc(`
				query UserFriends($count: Int = 10, $search: String = "bob") {
					user {
						friendsByOffset(offset: $count, filter: $search) {
							name
						}
					}
				}
			`),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "UserFriends",
			    "kind": "HoudiniQuery",
			    "hash": "b2639e5dd717d1b61306ffd329891f06ef1d0d846a6ee7c3861aac1b499a0e08",

			    "raw": \`query UserFriends($count: Int = 10, $search: String = "bob") {
			  user {
			    friendsByOffset(offset: $count, filter: $search) {
			      name
			      id
			    }
			    id
			  }
			}\`,

			    "rootType": "Query",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "user": {
			                "type": "User",
			                "keyRaw": "user",

			                "selection": {
			                    "fields": {
			                        "friendsByOffset": {
			                            "type": "User",
			                            "keyRaw": "friendsByOffset(filter: $search, offset: $count)",

			                            "selection": {
			                                "fields": {
			                                    "name": {
			                                        "type": "String",
			                                        "keyRaw": "name",
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

			    "input": {
			        "fields": {
			            "count": "Int",
			            "search": "String"
			        },

			        "types": {},

			        "defaults": {
			            "count": 10,
			            "search": "bob"
			        },

			        "runtimeScalars": {}
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=d1f65a0e526e297d58858015a806c475bdca0a1b153f3ee839712ec7ee6190ff";
		`)
	})

	test('handles base scalars correctly', async function () {
		// the config to use in tests
		const config = testConfig()
		// the documents to test
		const docs: Document[] = [
			mockCollectedDoc(`
				query ListUsers($bool: Boolean = true, $int: Int = 5, $float: Float = 3.14, $string: String = "hello world") {
					users(boolValue: $bool, intValue: $int, floatValue: $float, stringValue: $string) {
						name
					}
				}
			`),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "ListUsers",
			    "kind": "HoudiniQuery",
			    "hash": "82f257aed5de76e96f8662a2e72f339278a8512b6d319cdbca1e3cf12a839b5f",

			    "raw": \`query ListUsers($bool: Boolean = true, $int: Int = 5, $float: Float = 3.14, $string: String = "hello world") {
			  users(
			    boolValue: $bool
			    intValue: $int
			    floatValue: $float
			    stringValue: $string
			  ) {
			    name
			    id
			  }
			}\`,

			    "rootType": "Query",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "users": {
			                "type": "User",
			                "keyRaw": "users(boolValue: $bool, floatValue: $float, intValue: $int, stringValue: $string)",

			                "selection": {
			                    "fields": {
			                        "name": {
			                            "type": "String",
			                            "keyRaw": "name",
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

			    "input": {
			        "fields": {
			            "bool": "Boolean",
			            "int": "Int",
			            "float": "Float",
			            "string": "String"
			        },

			        "types": {},

			        "defaults": {
			            "bool": true,
			            "int": 5,
			            "float": 3.14,
			            "string": "hello world"
			        },

			        "runtimeScalars": {}
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=f8edbf4199a63a56d214cd5c845d90310052da75c45f3f3f5abf5f5cdb707a3e";
		`)
	})

	test('handles complex default arguments', async function () {
		// the config to use in tests
		const config = testConfig()
		// the documents to test
		const docs: Document[] = [
			mockCollectedDoc(`
				query FindUser($filter: UserFilter = { name: "bob" }) {
					usersByOffset(offset: 5, filter: $filter) {
						name
					}
				}
			`),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "FindUser",
			    "kind": "HoudiniQuery",
			    "hash": "e3c7682e66769f2f9c9f69fd3ddd9a6e4de596c24bd0121ecc1dcfac547cf2ee",

			    "raw": \`query FindUser($filter: UserFilter = {name: "bob"}) {
			  usersByOffset(offset: 5, filter: $filter) {
			    name
			    id
			  }
			}\`,

			    "rootType": "Query",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "usersByOffset": {
			                "type": "User",
			                "keyRaw": "usersByOffset(filter: $filter, offset: 5)",

			                "selection": {
			                    "fields": {
			                        "name": {
			                            "type": "String",
			                            "keyRaw": "name",
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

			    "input": {
			        "fields": {
			            "filter": "UserFilter"
			        },

			        "types": {
			            "UserFilter": {
			                "name": "String"
			            }
			        },

			        "defaults": {
			            "filter": {
			                "name": "bob"
			            }
			        },

			        "runtimeScalars": {}
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=4b2886d3afb40660837727c266b5667c81698e3bbf240ec47270a262842f61d8";
		`)
	})
})

test('persists dedupe which', async function () {
	// the config to use in tests
	const config = testConfig()
	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`
			query FindUser @dedupe{
				usersByOffset {
					name
				}
			}
		`),
	]

	// execute the generator
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "FindUser",
		    "kind": "HoudiniQuery",
		    "hash": "db913235b0a6aa335c7d240ade03de4ee31d537ada41994f2e6b42aac3afa7b0",

		    "raw": \`query FindUser {
		  usersByOffset {
		    name
		    id
		  }
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "usersByOffset": {
		                "type": "User",
		                "keyRaw": "usersByOffset",

		                "selection": {
		                    "fields": {
		                        "name": {
		                            "type": "String",
		                            "keyRaw": "name",
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
		        "match": "Operation"
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=752d5f5b068733a0ab1039b96b5f9d13a45a872329bca86998b1971c4ce0816b";
	`)
})

test('persists dedupe first', async function () {
	// the config to use in tests
	const config = testConfig()
	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`
			query FindUser @dedupe(cancelFirst: true) {
				usersByOffset {
					name
				}
			}
		`),
	]

	// execute the generator
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "FindUser",
		    "kind": "HoudiniQuery",
		    "hash": "db913235b0a6aa335c7d240ade03de4ee31d537ada41994f2e6b42aac3afa7b0",

		    "raw": \`query FindUser {
		  usersByOffset {
		    name
		    id
		  }
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "usersByOffset": {
		                "type": "User",
		                "keyRaw": "usersByOffset",

		                "selection": {
		                    "fields": {
		                        "name": {
		                            "type": "String",
		                            "keyRaw": "name",
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
		        "cancel": "first",
		        "match": "Operation"
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=3dfb64916aa4359cf85f08b3544bbc7382fd818935c5a0e92f324a2d2519c227";
	`)
})

describe('Parses the correct matching mode', function () {
	test('match mode variables', async function () {
		// the config to use in tests
		const config = testConfig()
		// the documents to test
		const docs: Document[] = [
			mockCollectedDoc(`
			query FindUser @dedupe(match: Variables) {
				usersByOffset {
					name
				}
			}
		`),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "FindUser",
			    "kind": "HoudiniQuery",
			    "hash": "db913235b0a6aa335c7d240ade03de4ee31d537ada41994f2e6b42aac3afa7b0",

			    "raw": \`query FindUser {
			  usersByOffset {
			    name
			    id
			  }
			}\`,

			    "rootType": "Query",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "usersByOffset": {
			                "type": "User",
			                "keyRaw": "usersByOffset",

			                "selection": {
			                    "fields": {
			                        "name": {
			                            "type": "String",
			                            "keyRaw": "name",
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

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=f3faa6e93bde578b11490f9a32518e410a47ec242b0ef94331fc4fb5b01ace20";
		`)
	})

	test('match mode operation', async function () {
		// the config to use in tests
		const config = testConfig()
		// the documents to test
		const docs: Document[] = [
			mockCollectedDoc(`
			query FindUser @dedupe(match: Operation) {
				usersByOffset {
					name
				}
			}
		`),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "FindUser",
			    "kind": "HoudiniQuery",
			    "hash": "db913235b0a6aa335c7d240ade03de4ee31d537ada41994f2e6b42aac3afa7b0",

			    "raw": \`query FindUser {
			  usersByOffset {
			    name
			    id
			  }
			}\`,

			    "rootType": "Query",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "usersByOffset": {
			                "type": "User",
			                "keyRaw": "usersByOffset",

			                "selection": {
			                    "fields": {
			                        "name": {
			                            "type": "String",
			                            "keyRaw": "name",
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
			        "match": "Operation"
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=1e1c9cd888a109d85a8bda7c3470aeb645b25678fa17916a3b016816b7a9d783";
		`)
	})
})
