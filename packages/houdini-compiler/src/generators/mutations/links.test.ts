// external imports
import { testConfig } from 'houdini-common'
import * as graphql from 'graphql'
import fs from 'fs/promises'
// local imports
import runGenerators from '.'
import { CollectedGraphQLDocument } from '../../types'
import '../../../../../jest.setup'

const config = testConfig()

test('generates a link file for each intersection', async function () {
	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		// the query needs to ask for a field that the mutation could update
		{
			name: 'TestQuery1',
			document: graphql.parse(`query TestQuery1 { user { id firstName } }`),
		},
		{
			name: 'TestQuery2',
			document: graphql.parse(`query TestQuery2 { user { id firstName } }`),
		},
		{
			name: 'TestMutation',
			document: graphql.parse(`mutation TestMutation { updateUser { id firstName } }`),
		},
	]

	// run the generators
	await runGenerators(config, docs)

	// look up the files in the mutation directory
	const files = await fs.readdir(config.mutationLinksDirectory)

	// there should be only one link
	expect(files).toEqual(['TestMutation.js'])

	// read the contents of the file
	const contents = await fs.readFile(config.mutationLinksPath('TestMutation'), 'utf-8')

	expect(contents).toMatchInlineSnapshot(`
		"export default {
		    \\"TestQuery1\\": import(\\"../patches/TestMutation_TestQuery1.js\\"),
		    \\"TestQuery2\\": import(\\"../patches/TestMutation_TestQuery2.js\\")
		};"
	`)
})
