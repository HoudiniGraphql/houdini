// external imports
import { testConfig } from 'houdini-common'
import path from 'path'
import fs from 'fs/promises'
import * as typeScriptParser from 'recast/parsers/typescript'
import { ProgramKind } from 'ast-types/gen/kinds'
import * as recast from 'recast'
// local imports
import '../../../../jest.setup'
import { runPipeline } from '../generate'
import { mockCollectedDoc } from '../testUtils'

test('pass argument values to generated fragments', async function () {
	const docs = [
		mockCollectedDoc(
			'TestQuery',
			`
				query AllUsers {
                    ...QueryFragment @with(name: "Hello")
				}
			`
		),
		mockCollectedDoc(
			'QueryFragment',
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

	const queryContents = await fs.readFile(
		path.join(config.artifactPath(docs[0].document)),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "TestQuery",
		    kind: "HoudiniQuery",
		    hash: "f597753fecc388a85e548e82ab27681b",

		    raw: \`query AllUsers {
		  ...QueryFragment_10b3uv
		}

		fragment QueryFragment_10b3uv on Query {
		  users(stringValue: "Hello") {
		    id
		  }
		}
		\`,

		    rootType: "Query",

		    selection: {
		        "users": {
		            "type": "User",
		            "keyRaw": "users(stringValue: \\"Hello\\")",

		            "fields": {
		                "id": {
		                    "type": "ID",
		                    "keyRaw": "id"
		                }
		            }
		        }
		    }
		};
	`)
})

test("fragment arguments with default values don't rename the fragment", async function () {
	const docs = [
		mockCollectedDoc(
			'TestQuery',
			`
				query AllUsers {
                    ...QueryFragment
				}
			`
		),
		mockCollectedDoc(
			'QueryFragment',
			`
				fragment QueryFragment on Query 
                @arguments(name: {type: "String", defaultValue: "Hello"}) {
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

	const queryContents = await fs.readFile(
		path.join(config.artifactPath(docs[0].document)),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "TestQuery",
		    kind: "HoudiniQuery",
		    hash: "9ccb20793686cffd16dcdb9ed2a0f9e4",

		    raw: \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  users(stringValue: "Hello") {
		    id
		  }
		}
		\`,

		    rootType: "Query",

		    selection: {
		        "users": {
		            "type": "User",
		            "keyRaw": "users(stringValue: \\"Hello\\")",

		            "fields": {
		                "id": {
		                    "type": "ID",
		                    "keyRaw": "id"
		                }
		            }
		        }
		    }
		};
	`)
})

test('thread query variables to inner fragments', async function () {
	const docs = [
		mockCollectedDoc(
			'TestQuery',
			`
				query AllUsers($name: String!) {
                    ...QueryFragment @with(name: $name)
				}
			`
		),
		mockCollectedDoc(
			'QueryFragment',
			`
				fragment QueryFragment on Query 
                @arguments(name: {type: "String", defaultValue: "Hello"}) {
                    ...InnerFragment @with(name: $name)
				}
			`
		),
		mockCollectedDoc(
			'InnerFragment',
			`
				fragment InnerFragment on Query 
                @arguments(name: {type: "String", defaultValue: "Hello"}) {
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

	const queryContents = await fs.readFile(
		path.join(config.artifactPath(docs[0].document)),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "TestQuery",
		    kind: "HoudiniQuery",
		    hash: "62c01b64ba6efc0ba62c4a2354f5e386",

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
		}
		\`,

		    rootType: "Query",

		    selection: {
		        "users": {
		            "type": "User",
		            "keyRaw": "users(stringValue: $name)",

		            "fields": {
		                "id": {
		                    "type": "ID",
		                    "keyRaw": "id"
		                }
		            }
		        }
		    },

		    input: {
		        "fields": {
		            "name": "String"
		        },

		        "types": {}
		    }
		};
	`)
})

test('inner fragment with intermediate default value', async function () {
	const docs = [
		mockCollectedDoc(
			'TestQuery',
			`
				query AllUsers {
                    ...QueryFragment
				}
			`
		),
		mockCollectedDoc(
			'QueryFragment',
			`
				fragment QueryFragment on Query 
                @arguments(name: {type: "String", defaultValue: "Hello"}) {
                    ...InnerFragment @with(name: $name)
				}
			`
		),
		mockCollectedDoc(
			'InnerFragment',
			`
				fragment InnerFragment on Query 
                @arguments(name: {type: "String", defaultValue: "Goodbye"}) {
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

	const queryContents = await fs.readFile(
		path.join(config.artifactPath(docs[0].document)),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "TestQuery",
		    kind: "HoudiniQuery",
		    hash: "9ccb20793686cffd16dcdb9ed2a0f9e4",

		    raw: \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  ...InnerFragment_10b3uv
		}

		fragment InnerFragment_10b3uv on Query {
		  users(stringValue: "Hello") {
		    id
		  }
		}
		\`,

		    rootType: "Query",

		    selection: {
		        "users": {
		            "type": "User",
		            "keyRaw": "users(stringValue: \\"Hello\\")",

		            "fields": {
		                "id": {
		                    "type": "ID",
		                    "keyRaw": "id"
		                }
		            }
		        }
		    }
		};
	`)
})

test("default values don't overwrite unless explicitly passed", async function () {
	const docs = [
		mockCollectedDoc(
			'TestQuery',
			`
				query AllUsers {
                    ...QueryFragment
				}
			`
		),
		mockCollectedDoc(
			'QueryFragment',
			`
				fragment QueryFragment on Query 
                @arguments(name: {type: "String", defaultValue: "Hello"}) {
                    ...InnerFragment
				}
			`
		),
		mockCollectedDoc(
			'InnerFragment',
			`
				fragment InnerFragment on Query 
                @arguments(name: {type: "String", defaultValue: "Goodbye"}) {
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

	const queryContents = await fs.readFile(
		path.join(config.artifactPath(docs[0].document)),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "TestQuery",
		    kind: "HoudiniQuery",
		    hash: "9ccb20793686cffd16dcdb9ed2a0f9e4",

		    raw: \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  ...InnerFragment
		}

		fragment InnerFragment on Query {
		  users(stringValue: "Goodbye") {
		    id
		  }
		}
		\`,

		    rootType: "Query",

		    selection: {
		        "users": {
		            "type": "User",
		            "keyRaw": "users(stringValue: \\"Goodbye\\")",

		            "fields": {
		                "id": {
		                    "type": "ID",
		                    "keyRaw": "id"
		                }
		            }
		        }
		    }
		};
	`)
})

test('default arguments', async function () {
	const docs = [
		mockCollectedDoc(
			'TestQuery',
			`
				query AllUsers {
                    ...QueryFragment
				}
			`
		),
		mockCollectedDoc(
			'QueryFragment',
			`
				fragment QueryFragment on Query 
                @arguments(name: {type: "String", defaultValue: "Hello"}, cool: {type: "Boolean", defaultValue: true}) {
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

	const queryContents = await fs.readFile(
		path.join(config.artifactPath(docs[0].document)),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "TestQuery",
		    kind: "HoudiniQuery",
		    hash: "9ccb20793686cffd16dcdb9ed2a0f9e4",

		    raw: \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  users(boolValue: true, stringValue: "Hello") {
		    id
		  }
		}
		\`,

		    rootType: "Query",

		    selection: {
		        "users": {
		            "type": "User",
		            "keyRaw": "users(boolValue: true, stringValue: \\"Hello\\")",

		            "fields": {
		                "id": {
		                    "type": "ID",
		                    "keyRaw": "id"
		                }
		            }
		        }
		    }
		};
	`)
})

test('multiple with directives - no overlap', async function () {
	const docs = [
		mockCollectedDoc(
			'TestQuery',
			`
				query AllUsers {
                    ...QueryFragment @with(name: "Goodbye") @with(cool: false)
				}
			`
		),
		mockCollectedDoc(
			'QueryFragment',
			`
				fragment QueryFragment on Query 
                @arguments(name: {type: "String", defaultValue: "Hello"}, cool: {type: "Boolean", defaultValue: true}) {
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

	const queryContents = await fs.readFile(
		path.join(config.artifactPath(docs[0].document)),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "TestQuery",
		    kind: "HoudiniQuery",
		    hash: "fbd2cd30c634b3079212fbf37a1e3eca",

		    raw: \`query AllUsers {
		  ...QueryFragment_2prn0K
		}

		fragment QueryFragment_2prn0K on Query {
		  users(boolValue: false, stringValue: "Goodbye") {
		    id
		  }
		}
		\`,

		    rootType: "Query",

		    selection: {
		        "users": {
		            "type": "User",
		            "keyRaw": "users(boolValue: false, stringValue: \\"Goodbye\\")",

		            "fields": {
		                "id": {
		                    "type": "ID",
		                    "keyRaw": "id"
		                }
		            }
		        }
		    }
		};
	`)
})
