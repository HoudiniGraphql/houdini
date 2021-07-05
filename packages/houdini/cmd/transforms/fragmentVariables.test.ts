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
		  ...QueryFragment_3nkHFU
		}

		fragment QueryFragment_3nkHFU on Query {
		  ...InnerFragment_1W0ukG
		}

		fragment InnerFragment_1W0ukG on Query {
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

test.todo('multiple with directives - no overlap')

test.todo('multiple with arguments - overlap')
