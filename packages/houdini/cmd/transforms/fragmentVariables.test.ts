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

test('threads argument values to generated fragments', async function () {
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
				fragment QueryFragment on Query @arguments(name: {type: "String"} ) {
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
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  users(stringValue: $name) {
		    id
		  }
		}
		\`,

		    rootType: "Query",

		    selection: {
		        "users": {
		            "type": "User",
		            "keyRaw": "users(stringValue: )",

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
