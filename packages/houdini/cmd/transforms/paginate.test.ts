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

test('adds pagination info', async function () {
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
	expect(graphql.print(docs[0].document)).toMatchInlineSnapshot(`
		"fragment UserFriends on User {
		  friendsByCursor(first: 10) @paginate {
		    edges {
		      node {
		        id
		      }
		    }
		    edges {
		      cursor
		    }
		    pageInfo {
		      hasPreviousPage
		      hasNextPage
		      startCursor
		      endCursor
		    }
		  }
		}
		"
	`)
})

test("doesn't add pagination info to offset pagination", async function () {
	const docs = [
		mockCollectedDoc(
			'TestPaginationFields',
			`
                fragment UserFriends on User {
                    friendsByOffset(limit: 10) @paginate {
						id
                    }
                }
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	// load the contents of the file
	expect(graphql.print(docs[0].document)).toMatchInlineSnapshot(`
		"fragment UserFriends on User {
		  friendsByOffset(limit: 10) @paginate {
		    id
		  }
		}
		"
	`)
})
