// external imports
import { testConfig } from 'houdini-common'
import * as graphql from 'graphql'
import * as recast from 'recast'
import { ProgramKind } from 'ast-types/gen/kinds'
import fs from 'fs/promises'
import path from 'path'
import * as typeScriptParser from 'recast/parsers/typescript'
// local imports
import '../../../../jest.setup'
import { runPipeline } from '../generate'
import { mockCollectedDoc } from '../testUtils'

test('adds page info to cursor pagination', async function () {
	const docs = [
		mockCollectedDoc(
			'TestPaginationFields',
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

	// load the contents of the file
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
		    name: "TestPaginationFields",
		    kind: "HoudiniFragment",

		    raw: \`fragment UserFriends on User {
		  friendsByCursor(first: 10) {
		    edges {
		      node {
		        id
		      }
		    }
		  }
		}
		\`,

		    rootType: "User",

		    selection: {
		        "friendsByCursor": {
		            "type": "UserConnection",
		            "keyRaw": "friendsByCursor(first: 10)",

		            "fields": {
		                "edges": {
		                    "type": "UserEdge",
		                    "keyRaw": "edges",

		                    "fields": {
		                        "node": {
		                            "type": "User",
		                            "keyRaw": "node",

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
		};
	`)
})
