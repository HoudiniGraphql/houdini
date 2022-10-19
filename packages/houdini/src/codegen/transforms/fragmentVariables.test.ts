import type { ProgramKind } from 'ast-types/gen/kinds'
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
		    name: "AllUsers",
		    kind: "HoudiniQuery",
		    hash: "1e1735126b2b1cc305ad7477fdd7e670e53f2bf58b2861b904ff2c076e9545ba",

		    raw: \`query AllUsers {
		  ...QueryFragment_10b3uv
		}

		fragment QueryFragment_10b3uv on Query {
		  users(stringValue: "Hello") {
		    id
		  }
		}\`,

		    rootType: "Query",

		    selection: {
		        users: {
		            type: "User",
		            keyRaw: "users(stringValue: \\"Hello\\")",

		            fields: {
		                id: {
		                    type: "ID",
		                    keyRaw: "id"
		                }
		            }
		        }
		    },

		    policy: "CacheOrNetwork",
		    partial: false
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
		    name: "AllUsers",
		    kind: "HoudiniQuery",
		    hash: "f09634eff790efeeeac358898927bb3de4f6e9d399ef2edce6b676bdd6990a34",

		    raw: \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  users {
		    id
		  }
		}\`,

		    rootType: "Query",

		    selection: {
		        users: {
		            type: "User",
		            keyRaw: "users",

		            fields: {
		                id: {
		                    type: "ID",
		                    keyRaw: "id"
		                }
		            }
		        }
		    },

		    policy: "CacheOrNetwork",
		    partial: false
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
		    name: "AllUsers",
		    kind: "HoudiniQuery",
		    hash: "075b137c07d965a6314f2e26317caaaf46b4a9dad4028aed011ab1bc08984848",

		    raw: \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  users(stringValue: "Hello") {
		    id
		  }
		}\`,

		    rootType: "Query",

		    selection: {
		        users: {
		            type: "User",
		            keyRaw: "users(stringValue: \\"Hello\\")",

		            fields: {
		                id: {
		                    type: "ID",
		                    keyRaw: "id"
		                }
		            }
		        }
		    },

		    policy: "CacheOrNetwork",
		    partial: false
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
		    name: "AllUsers",
		    kind: "HoudiniQuery",
		    hash: "1b7f099e8c65dc28bbe8b2f1fbb40560a48cc556a16e379bd3c538f41c53a2ed",

		    raw: \`query AllUsers($name: String!) {
		  ...QueryFragment_VDHGm
		}

		fragment QueryFragment_VDHGm on Query {
		  ...InnerFragment_VDHGm
		}

		fragment InnerFragment_VDHGm on Query {
		  users(stringValue: $name) {
		    id
		  }
		}\`,

		    rootType: "Query",

		    selection: {
		        users: {
		            type: "User",
		            keyRaw: "users(stringValue: $name)",

		            fields: {
		                id: {
		                    type: "ID",
		                    keyRaw: "id"
		                }
		            }
		        }
		    },

		    input: {
		        fields: {
		            name: "String"
		        },

		        types: {}
		    },

		    policy: "CacheOrNetwork",
		    partial: false
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
		    name: "AllUsers",
		    kind: "HoudiniQuery",
		    hash: "90f7cd2265f1a788dd7c2a8e4a6a43daf1f606fc7f37fd4ddd8157bb28c799f0",

		    raw: \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  ...InnerFragment_10b3uv
		}

		fragment InnerFragment_10b3uv on Query {
		  users(stringValue: "Hello", intValue: 2) {
		    id
		  }
		}\`,

		    rootType: "Query",

		    selection: {
		        users: {
		            type: "User",
		            keyRaw: "users(stringValue: \\"Hello\\", intValue: 2)",

		            fields: {
		                id: {
		                    type: "ID",
		                    keyRaw: "id"
		                }
		            }
		        }
		    },

		    policy: "CacheOrNetwork",
		    partial: false
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
		    name: "AllUsers",
		    kind: "HoudiniQuery",
		    hash: "d2a76fb293043d9d6fb2264237a5468bee7d974d93af7495a2cb7225cc952b8b",

		    raw: \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  ...InnerFragment_2geNXY
		}

		fragment InnerFragment_2geNXY on Query {
		  users(stringValue: "Goodbye", intValue: 10) {
		    id
		  }
		}\`,

		    rootType: "Query",

		    selection: {
		        users: {
		            type: "User",
		            keyRaw: "users(stringValue: \\"Goodbye\\", intValue: 10)",

		            fields: {
		                id: {
		                    type: "ID",
		                    keyRaw: "id"
		                }
		            }
		        }
		    },

		    policy: "CacheOrNetwork",
		    partial: false
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
		    name: "AllUsers",
		    kind: "HoudiniQuery",
		    hash: "59f8191d32aebd9a49c3ea3d7c209f6ba63e905b91b5ac7b4ef6a02b8ff7e7af",

		    raw: \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  users(boolValue: true, stringValue: "Hello") {
		    id
		  }
		}\`,

		    rootType: "Query",

		    selection: {
		        users: {
		            type: "User",
		            keyRaw: "users(boolValue: true, stringValue: \\"Hello\\")",

		            fields: {
		                id: {
		                    type: "ID",
		                    keyRaw: "id"
		                }
		            }
		        }
		    },

		    policy: "CacheOrNetwork",
		    partial: false
		};

		"HoudiniHash=774e85c1a749388df97ed5768006535072408ceea2a7bba3c835553e2d65e5bd";
	`)
})

test('multiple with directives - no overlap', async function () {
	const docs = [
		mockCollectedDoc(
			`
				query AllUsers {
                    ...QueryFragment @with(name: "Goodbye") @with(cool: false)
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
		    name: "AllUsers",
		    kind: "HoudiniQuery",
		    hash: "b78aef48c431b5b61fde1ddc8be635b07b1972d1f1454d53c80ac80c4bbbc36b",

		    raw: \`query AllUsers {
		  ...QueryFragment_2prn0K
		}

		fragment QueryFragment_2prn0K on Query {
		  users(boolValue: false, stringValue: "Goodbye") {
		    id
		  }
		}\`,

		    rootType: "Query",

		    selection: {
		        users: {
		            type: "User",
		            keyRaw: "users(boolValue: false, stringValue: \\"Goodbye\\")",

		            fields: {
		                id: {
		                    type: "ID",
		                    keyRaw: "id"
		                }
		            }
		        }
		    },

		    policy: "CacheOrNetwork",
		    partial: false
		};

		"HoudiniHash=10b3cd7304221a7e9337b66dd1b083c11cafad428fe02bc0b889f2eb5fe524ff";
	`)
})
