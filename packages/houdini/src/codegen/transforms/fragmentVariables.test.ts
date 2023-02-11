import type { ProgramKind } from 'ast-types/lib/gen/kinds'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
import { test, expect } from 'vitest'

import { runPipeline } from '../../codegen'
import { fs, path } from '../../lib'
import { testConfig, mockCollectedDoc } from '../../test'

test('pass argument values to generated fragments', async function () {
	const docs = [
		mockCollectedDoc(
			`
				query AllUsers {
                    ...QueryFragment @with(name: "Hello")
				}
			`
		),
		mockCollectedDoc(
			`
				fragment QueryFragment on Query
                @arguments(name: {type: "String!"} ) {
                    users(stringValue: $name) {
                        id
                    }
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	const queryContents = await fs.readFile(path.join(config.artifactPath(docs[0].document)))
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		export default {
		    "name": "AllUsers",
		    "kind": "HoudiniQuery",
		    "hash": "fb97ee7e3f483801de403f425fcd2b4ed5c1357ffc3d73394e34c23b278552b1",

		    "raw": \`query AllUsers {
		  ...QueryFragment_10b3uv
		}

		fragment QueryFragment_10b3uv on Query {
		  users(stringValue: "Hello") {
		    id
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User",
		                "keyRaw": "users(stringValue: \\"Hello\\")",

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

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=fb97ee7e3f483801de403f425fcd2b4ed5c1357ffc3d73394e34c23b278552b1";
	`)
})

test("nullable arguments with no values don't show up in the query", async function () {
	const docs = [
		mockCollectedDoc(
			`
				query AllUsers {
                    ...QueryFragment
				}
			`
		),
		mockCollectedDoc(
			`
				fragment QueryFragment on Query
                @arguments(name: {type: "String"} ) {
                    users(stringValue: $name) {
                        id
                    }
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	const queryContents = await fs.readFile(path.join(config.artifactPath(docs[0].document)))
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		export default {
		    "name": "AllUsers",
		    "kind": "HoudiniQuery",
		    "hash": "774e85c1a749388df97ed5768006535072408ceea2a7bba3c835553e2d65e5bd",

		    "raw": \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  users {
		    id
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User",
		                "keyRaw": "users",

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

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=774e85c1a749388df97ed5768006535072408ceea2a7bba3c835553e2d65e5bd";
	`)
})

test("fragment arguments with default values don't rename the fragment", async function () {
	const docs = [
		mockCollectedDoc(
			`
				query AllUsers {
                    ...QueryFragment
				}
			`
		),
		mockCollectedDoc(
			`
				fragment QueryFragment on Query
                @arguments(name: {type: "String", default: "Hello"}) {
                    users(stringValue: $name) {
                        id
                    }
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	const queryContents = await fs.readFile(path.join(config.artifactPath(docs[0].document)))
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		export default {
		    "name": "AllUsers",
		    "kind": "HoudiniQuery",
		    "hash": "774e85c1a749388df97ed5768006535072408ceea2a7bba3c835553e2d65e5bd",

		    "raw": \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  users(stringValue: "Hello") {
		    id
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User",
		                "keyRaw": "users(stringValue: \\"Hello\\")",

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

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=774e85c1a749388df97ed5768006535072408ceea2a7bba3c835553e2d65e5bd";
	`)
})

test('thread query variables to inner fragments', async function () {
	const docs = [
		mockCollectedDoc(
			`
				query AllUsers($name: String!) {
                    ...QueryFragment @with(name: $name)
				}
			`
		),
		mockCollectedDoc(
			`
				fragment QueryFragment on Query
                @arguments(name: {type: "String", default: "Hello"}) {
                    ...InnerFragment @with(name: $name)
				}
			`
		),
		mockCollectedDoc(
			`
				fragment InnerFragment on Query
                @arguments(name: {type: "String", default: "Hello"}) {
                    users(stringValue: $name) {
                        id
                    }
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	const queryContents = await fs.readFile(path.join(config.artifactPath(docs[0].document)))
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		export default {
		    "name": "AllUsers",
		    "kind": "HoudiniQuery",
		    "hash": "7add8faa7fad1d3ba59adacc533e8e1ab6f92b4805a48b14665eb35591e96bb0",

		    "raw": \`query AllUsers($name: String!) {
		  ...QueryFragment_VDHGm
		}

		fragment QueryFragment_VDHGm on Query {
		  ...InnerFragment_VDHGm
		}

		fragment InnerFragment_VDHGm on Query {
		  users(stringValue: $name) {
		    id
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User",
		                "keyRaw": "users(stringValue: $name)",

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

		    "pluginData": {},

		    "input": {
		        "fields": {
		            "name": "String"
		        },

		        "types": {}
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=7add8faa7fad1d3ba59adacc533e8e1ab6f92b4805a48b14665eb35591e96bb0";
	`)
})

test('inner fragment with intermediate default value', async function () {
	const docs = [
		mockCollectedDoc(
			`
				query AllUsers {
                    ...QueryFragment
				}
			`
		),
		mockCollectedDoc(
			`
				fragment QueryFragment on Query
                @arguments(name: {type: "String", default: "Hello"}) {
                    ...InnerFragment @with(name: $name)
				}
			`
		),
		mockCollectedDoc(
			`
				fragment InnerFragment on Query
                @arguments(name: {type: "String", default: "Goodbye"}, age: {type: "Int", default: 2}) {
                    users(stringValue: $name, intValue: $age) {
                        id
                    }
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	const queryContents = await fs.readFile(path.join(config.artifactPath(docs[0].document)))
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		export default {
		    "name": "AllUsers",
		    "kind": "HoudiniQuery",
		    "hash": "774e85c1a749388df97ed5768006535072408ceea2a7bba3c835553e2d65e5bd",

		    "raw": \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  ...InnerFragment_10b3uv
		}

		fragment InnerFragment_10b3uv on Query {
		  users(stringValue: "Hello", intValue: 2) {
		    id
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User",
		                "keyRaw": "users(intValue: 2, stringValue: \\"Hello\\")",

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

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=774e85c1a749388df97ed5768006535072408ceea2a7bba3c835553e2d65e5bd";
	`)
})

test("default values don't overwrite unless explicitly passed", async function () {
	const docs = [
		mockCollectedDoc(
			`
				query AllUsers {
                    ...QueryFragment
				}
			`
		),
		mockCollectedDoc(
			`
				fragment QueryFragment on Query
                @arguments(name: {type: "Int", default: 10}) {
                    ...InnerFragment @with(other: $name)
				}
			`
		),
		mockCollectedDoc(
			`
				fragment InnerFragment on Query
                @arguments(name: {type: "String", default: "Goodbye"}, other: { type: "Int"}) {
                    users(stringValue: $name, intValue: $other) {
                        id
                    }
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	const queryContents = await fs.readFile(path.join(config.artifactPath(docs[0].document)))
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		export default {
		    "name": "AllUsers",
		    "kind": "HoudiniQuery",
		    "hash": "774e85c1a749388df97ed5768006535072408ceea2a7bba3c835553e2d65e5bd",

		    "raw": \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  ...InnerFragment_2geNXY
		}

		fragment InnerFragment_2geNXY on Query {
		  users(stringValue: "Goodbye", intValue: 10) {
		    id
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User",
		                "keyRaw": "users(intValue: 10, stringValue: \\"Goodbye\\")",

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

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=774e85c1a749388df97ed5768006535072408ceea2a7bba3c835553e2d65e5bd";
	`)
})

test('default arguments', async function () {
	const docs = [
		mockCollectedDoc(
			`
				query AllUsers {
                    ...QueryFragment
				}
			`
		),
		mockCollectedDoc(
			`
				fragment QueryFragment on Query
                @arguments(name: {type: "String", default: "Hello"}, cool: {type: "Boolean", default: true}) {
                    users(boolValue: $cool, stringValue: $name) {
						id
					}
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	const queryContents = await fs.readFile(path.join(config.artifactPath(docs[0].document)))
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		export default {
		    "name": "AllUsers",
		    "kind": "HoudiniQuery",
		    "hash": "774e85c1a749388df97ed5768006535072408ceea2a7bba3c835553e2d65e5bd",

		    "raw": \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  users(boolValue: true, stringValue: "Hello") {
		    id
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User",
		                "keyRaw": "users(boolValue: true, stringValue: \\"Hello\\")",

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

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=774e85c1a749388df97ed5768006535072408ceea2a7bba3c835553e2d65e5bd";
	`)
})

test('list arguments', async function () {
	const docs = [
		mockCollectedDoc(
			`
				query AllUsers {
                    ...QueryFragment @with(ids: ["1"])
				}
			`
		),
		mockCollectedDoc(
			`
				fragment QueryFragment on Query
                @arguments(ids: {type: "[String]"}) {
                    nodes(ids: $ids) {
						id
					}
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	const queryContents = await fs.readFile(path.join(config.artifactPath(docs[0].document)))
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		export default {
		    "name": "AllUsers",
		    "kind": "HoudiniQuery",
		    "hash": "774e85c1a749388df97ed5768006535072408ceea2a7bba3c835553e2d65e5bd",

		    "raw": \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  users(boolValue: true, stringValue: "Hello") {
		    id
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User",
		                "keyRaw": "users(boolValue: true, stringValue: \\"Hello\\")",

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

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=774e85c1a749388df97ed5768006535072408ceea2a7bba3c835553e2d65e5bd";
	`)
})

test('persists fragment variables in artifact', async function () {
	const docs = [
		mockCollectedDoc(
			`
				fragment QueryFragment on Query
                @arguments(name: {type: "String", default: "Hello"}, cool: {type: "Boolean", default: true}) {
                    users(boolValue: $cool, stringValue: $name) {
						id
					}
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	// verify contents
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "QueryFragment",
		    "kind": "HoudiniFragment",
		    "hash": "6c327bb344ded7bcdfa0cb250d5139bb8e18d5618335b4e621a06576cb10a67f",

		    "raw": \`fragment QueryFragment on Query {
		  users(boolValue: $cool, stringValue: $name) {
		    id
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User",
		                "keyRaw": "users(boolValue: $cool, stringValue: $name)",

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

		    "pluginData": {},

		    "input": {
		        "fields": {
		            "name": "String",
		            "cool": "Boolean"
		        },

		        "types": {}
		    }
		};

		"HoudiniHash=6c327bb344ded7bcdfa0cb250d5139bb8e18d5618335b4e621a06576cb10a67f";
	`)
})
