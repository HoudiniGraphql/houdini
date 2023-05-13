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
		    "hash": "8e483259f3d69f416c01b6106c0440fa0f916abb4cadb75273f8226a1ff0a5e2",
		    "raw": "",
		    "rootType": "Query",

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

		"HoudiniHash=8e483259f3d69f416c01b6106c0440fa0f916abb4cadb75273f8226a1ff0a5e2";
	`)

	expect(docs[1]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestFragment",
		    "kind": "HoudiniFragment",
		    "hash": "ff694171ced9bd7edc84a4a4a4201dadea30c0cdb8a8734c940872a673111bc1",
		    "raw": "",
		    "rootType": "User",

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

		"HoudiniHash=ff694171ced9bd7edc84a4a4a4201dadea30c0cdb8a8734c940872a673111bc1";
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
		    "hash": "890fc6dbeb79ac80cb60bef98a20cb51a59b209e3d015a48a027b3db4e6624bd",
		    "raw": "",
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

		"HoudiniHash=890fc6dbeb79ac80cb60bef98a20cb51a59b209e3d015a48a027b3db4e6624bd";
	`)

	expect(selectionDocs[1]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestFragment",
		    "kind": "HoudiniFragment",
		    "hash": "ff694171ced9bd7edc84a4a4a4201dadea30c0cdb8a8734c940872a673111bc1",
		    "raw": "",
		    "rootType": "User",

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

		"HoudiniHash=ff694171ced9bd7edc84a4a4a4201dadea30c0cdb8a8734c940872a673111bc1";
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
		    "hash": "9d58041683e24088d4bab3f04c2a319aa675013b1eedc19e3a5714743bbb20f1",
		    "raw": "",
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

		"HoudiniHash=9d58041683e24088d4bab3f04c2a319aa675013b1eedc19e3a5714743bbb20f1";
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
		    "hash": "9d58041683e24088d4bab3f04c2a319aa675013b1eedc19e3a5714743bbb20f1",
		    "raw": "",
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

		        "types": {}
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=9d58041683e24088d4bab3f04c2a319aa675013b1eedc19e3a5714743bbb20f1";
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
		    "hash": "873d00120214b1dd16765e67c42314ec06468b8f3fa85812412147a5dc943367",
		    "raw": "",
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

		"HoudiniHash=873d00120214b1dd16765e67c42314ec06468b8f3fa85812412147a5dc943367";
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
		    "hash": "1523b7370764395a57e1a2434ea2e40290ac99d80a27c92438f8f053c0055998",
		    "raw": "",
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

		        "types": {}
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=1523b7370764395a57e1a2434ea2e40290ac99d80a27c92438f8f053c0055998";
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
		    "hash": "1d660603f2610ac59b38fd74f0b429f0c9c2cec3c64459cb222e7e26c7905e66",

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

		    "raw": "",
		    "rootType": "Query",

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

		"HoudiniHash=1d660603f2610ac59b38fd74f0b429f0c9c2cec3c64459cb222e7e26c7905e66";
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
		    "hash": "25298a9f5705b2f18c259a596d2c2b00003e9234712537af9b254589c6b36626",
		    "raw": "",
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

		"HoudiniHash=25298a9f5705b2f18c259a596d2c2b00003e9234712537af9b254589c6b36626";
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
		    "hash": "8181fa3d03ae23a9e754dc7942f43979a196e69cb694d40e13edece1d5712d0e",
		    "raw": "",
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

		"HoudiniHash=8181fa3d03ae23a9e754dc7942f43979a196e69cb694d40e13edece1d5712d0e";
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
		    "hash": "6177321339bc293d1e89ab4aa31893cbfddce34bfd8a26af1a1878df17659ce4",
		    "raw": "",
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

		"HoudiniHash=6177321339bc293d1e89ab4aa31893cbfddce34bfd8a26af1a1878df17659ce4";
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
		    "hash": "b97290b311e5555f225e6ce7281b2904531e6b0194fb70083b617835bacc3a61",
		    "raw": "",
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

		"HoudiniHash=b97290b311e5555f225e6ce7281b2904531e6b0194fb70083b617835bacc3a61";
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
		    "hash": "0c20b2d8114b50a67eb9bd23410ce7d8811b50c402d95665ccd48e3682af4175",
		    "raw": "",
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

		"HoudiniHash=0c20b2d8114b50a67eb9bd23410ce7d8811b50c402d95665ccd48e3682af4175";
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
		    "hash": "9ff85816b8980faa4ce2ff9540f1eb290312e3272b03984422282845f7627895",
		    "raw": "",
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

		"HoudiniHash=9ff85816b8980faa4ce2ff9540f1eb290312e3272b03984422282845f7627895";
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
			    "hash": "38005b47351eb4e6e14e3c13a8d0d206dac09bf80d6fa3c103a060a3990edd37",
			    "raw": "",
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

			"HoudiniHash=38005b47351eb4e6e14e3c13a8d0d206dac09bf80d6fa3c103a060a3990edd37";
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
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",
			    "raw": "",
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

			"HoudiniHash=7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2";
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
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",
			    "raw": "",
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

			"HoudiniHash=7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2";
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
			    "hash": "9dc41329a7176f813b623958a68c2752d391151a4f3b1f9b8198f6c487e931a4",
			    "raw": "",
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

			"HoudiniHash=9dc41329a7176f813b623958a68c2752d391151a4f3b1f9b8198f6c487e931a4";
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
			    "hash": "e01f8a23cc33c10c4ee3745c041ee97f428b3b4676a5d8d681124f75b09306da",
			    "raw": "",
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

			"HoudiniHash=e01f8a23cc33c10c4ee3745c041ee97f428b3b4676a5d8d681124f75b09306da";
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
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",
			    "raw": "",
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

			"HoudiniHash=7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2";
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
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",
			    "raw": "",
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

			"HoudiniHash=7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2";
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
			    "hash": "e01f8a23cc33c10c4ee3745c041ee97f428b3b4676a5d8d681124f75b09306da",
			    "raw": "",
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

			"HoudiniHash=e01f8a23cc33c10c4ee3745c041ee97f428b3b4676a5d8d681124f75b09306da";
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
			    "hash": "9dc41329a7176f813b623958a68c2752d391151a4f3b1f9b8198f6c487e931a4",
			    "raw": "",
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

			"HoudiniHash=9dc41329a7176f813b623958a68c2752d391151a4f3b1f9b8198f6c487e931a4";
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
			    "hash": "b9e1e926be309c06c868dc2472c082b6829f93ae55e000317a1066378590a85d",
			    "raw": "",
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

			"HoudiniHash=b9e1e926be309c06c868dc2472c082b6829f93ae55e000317a1066378590a85d";
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
			    "hash": "b9e1e926be309c06c868dc2472c082b6829f93ae55e000317a1066378590a85d",
			    "raw": "",
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

			"HoudiniHash=b9e1e926be309c06c868dc2472c082b6829f93ae55e000317a1066378590a85d";
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
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",
			    "raw": "",
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

			"HoudiniHash=7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2";
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
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",
			    "raw": "",
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

			"HoudiniHash=7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2";
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
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",
			    "raw": "",
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

			"HoudiniHash=7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2";
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
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",
			    "raw": "",
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

			"HoudiniHash=7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2";
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
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",
			    "raw": "",
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

			"HoudiniHash=7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2";
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
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",
			    "raw": "",
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

			"HoudiniHash=7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2";
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
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",
			    "raw": "",
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

			"HoudiniHash=7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2";
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
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",
			    "raw": "",
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

			"HoudiniHash=7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2";
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
			    "hash": "d773bead4120baa620dc05347fba277faaa5bb555e10943507a393eaa3399c52",
			    "raw": "",
			    "rootType": "Query",

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

			        "types": {}
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=d773bead4120baa620dc05347fba277faaa5bb555e10943507a393eaa3399c52";
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
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",
			    "raw": "",
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

			"HoudiniHash=7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2";
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
			    "hash": "2997353b3d1f04e02b9d211bb4f4069b63f8536b7f1eb686fc74fd8b3dab8dbd",
			    "raw": "",
			    "rootType": "Query",

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

			"HoudiniHash=2997353b3d1f04e02b9d211bb4f4069b63f8536b7f1eb686fc74fd8b3dab8dbd";
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
			    "hash": "6fe0aeaa708161553cd04645834b38c4ce625fce10c46056efcff9a97988d358",

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

			    "raw": "",
			    "rootType": "Query",

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

			"HoudiniHash=6fe0aeaa708161553cd04645834b38c4ce625fce10c46056efcff9a97988d358";
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
			    "hash": "6fe0aeaa708161553cd04645834b38c4ce625fce10c46056efcff9a97988d358",

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

			    "raw": "",
			    "rootType": "Query",

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

			"HoudiniHash=6fe0aeaa708161553cd04645834b38c4ce625fce10c46056efcff9a97988d358";
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
			    "hash": "d773bead4120baa620dc05347fba277faaa5bb555e10943507a393eaa3399c52",
			    "raw": "",
			    "rootType": "Query",

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

			        "types": {}
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=d773bead4120baa620dc05347fba277faaa5bb555e10943507a393eaa3399c52";
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
			    "hash": "d773bead4120baa620dc05347fba277faaa5bb555e10943507a393eaa3399c52",
			    "raw": "",
			    "rootType": "Query",

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

			        "types": {}
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=d773bead4120baa620dc05347fba277faaa5bb555e10943507a393eaa3399c52";
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
		    "raw": "",
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
		    "raw": "",
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
			    "hash": "755fb65bebc83835db68921b7e193809246fb6f9ee2e37cc66d7314b91a501e7",
			    "raw": "",
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

			"HoudiniHash=755fb65bebc83835db68921b7e193809246fb6f9ee2e37cc66d7314b91a501e7";
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
		    "hash": "8e483259f3d69f416c01b6106c0440fa0f916abb4cadb75273f8226a1ff0a5e2",
		    "raw": "",
		    "rootType": "Query",

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

		"HoudiniHash=8e483259f3d69f416c01b6106c0440fa0f916abb4cadb75273f8226a1ff0a5e2";
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
		    "hash": "bef32f9431c60063291fea8375de73b98c703421a89721d8b03a9e5e0ae373bd",
		    "raw": "",
		    "rootType": "Query",

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

		"HoudiniHash=bef32f9431c60063291fea8375de73b98c703421a89721d8b03a9e5e0ae373bd";
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
		    "hash": "ece1546c435cde03fdfb659b202fba2393b0b9828e8efbbe24f803a0707f3e02",
		    "raw": "",
		    "rootType": "Query",

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

		"HoudiniHash=ece1546c435cde03fdfb659b202fba2393b0b9828e8efbbe24f803a0707f3e02";
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
		    "hash": "d5c8c7b13dddb230796354b42cd0a86ac0beed1d3a40e8b9288545908f96370d",
		    "raw": "",
		    "rootType": "Query",

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

		"HoudiniHash=d5c8c7b13dddb230796354b42cd0a86ac0beed1d3a40e8b9288545908f96370d";
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
		    "hash": "4b37690e134a34ea1c717ee69ed60772d979a81120bfbed99b20a68e9c8ea738",
		    "raw": "",
		    "rootType": "Query",

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

		"HoudiniHash=4b37690e134a34ea1c717ee69ed60772d979a81120bfbed99b20a68e9c8ea738";
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
		    "hash": "15225d2e5cba866e1a588cd399a03d5b2124156ac7003d3510544f22b7b9262c",
		    "raw": "",
		    "rootType": "User",

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

		"HoudiniHash=15225d2e5cba866e1a588cd399a03d5b2124156ac7003d3510544f22b7b9262c";
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
		    "hash": "af247d6de9dde7a1cab76049b4590fcf075346eec4bc7fc4a8937f2d71e4aade",
		    "raw": "",
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

		        "types": {}
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=af247d6de9dde7a1cab76049b4590fcf075346eec4bc7fc4a8937f2d71e4aade";
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
		    "hash": "2f4654d4b23645ef3f39803cee2f770aea08e3b1716b5d4fa5efcbdf98a7ad08",
		    "raw": "",
		    "rootType": "Query",

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

		"HoudiniHash=2f4654d4b23645ef3f39803cee2f770aea08e3b1716b5d4fa5efcbdf98a7ad08";
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
		    "hash": "f8b2873db25ee257e57d33dce2ad02ea97ff20d623594812593a9fc75fe54527",
		    "raw": "",
		    "rootType": "Query",

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

		"HoudiniHash=f8b2873db25ee257e57d33dce2ad02ea97ff20d623594812593a9fc75fe54527";
	`)

	expect(docs[1]).toMatchInlineSnapshot(`
		export default {
		    "name": "AnimalsOverviewList",
		    "kind": "HoudiniFragment",
		    "hash": "80b0907b53d8a2fc39aa5fb018a75c8fc8d647ab741e3f4c4eea6a15ac5239cd",
		    "raw": "",
		    "rootType": "AnimalConnection",

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

		"HoudiniHash=80b0907b53d8a2fc39aa5fb018a75c8fc8d647ab741e3f4c4eea6a15ac5239cd";
	`)
})
