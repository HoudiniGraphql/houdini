// external imports
import * as recast from 'recast'
import path from 'path'
import { testConfig } from 'houdini-common'
import * as graphql from 'graphql'
import fs from 'fs/promises'
import { FileKind } from 'ast-types/gen/kinds'
import * as typeScriptParser from 'recast/parsers/typescript'
// local imports
import runGenerators from '.'
import { CollectedGraphQLDocument } from '../../types'
import '../../../../../jest.setup'

const config = testConfig()

test('generates patches', async function () {
	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		// the query needs to ask for a field that the mutation could update
		{
			name: 'TestQuery',
			document: graphql.parse(`query TestQuery { user { id firstName } }`),
		},
		{
			name: 'TestMutation',
			document: graphql.parse(`mutation TestMutation { updateUser { id firstName } }`),
		},
	]

	// run the generators
	await runGenerators(config, docs)

	// look up the files in the mutation directory
	const files = await fs.readdir(config.patchDirectory)

	// make sure we made two files
	expect(files).toHaveLength(1)
	// and they have the right names
	expect(files).toEqual(
		expect.arrayContaining([
			path.basename(config.patchPath({ query: 'TestQuery', mutation: 'TestMutation' })),
		])
	)

	// load the contents of the file
	const contents = await fs.readFile(
		config.patchPath({ query: 'TestQuery', mutation: 'TestMutation' }),
		'utf-8'
	)

	// make sure there is something
	expect(contents).toBeTruthy()

	// parse the contents
	const parsedContents: FileKind = recast.parse(contents, {
		parser: typeScriptParser,
	})

	// make sure this doesn't change without approval
	expect(parsedContents).toMatchInlineSnapshot(`
		export default {
		    "fields": {},

		    "edges": {
		        "updateUser": {
		            "fields": {
		                "firstName": [["user", "firstName"]]
		            },

		            "edges": {}
		        }
		    }
		};
	`)
})

test.skip('inline fragments in mutation body count as an intersection', function () {})

test.skip('inline fragments in queries count as an intersection', function () {})

test.skip('inline fragments in fragments count as an intersection', function () {})

test.skip('fragment spread in mutation body', function () {})

test.skip("nested objects that don't have id should also update", function () {})
