// external imports
import mock from 'mock-fs'
import path from 'path'
import { testConfig } from 'houdini-common'
import * as graphql from 'graphql'
import fs from 'fs/promises'
// local imports
import runGenerators from '.'
import { CollectedGraphQLDocument } from '../types'

// we need to make sure to mock out the filesystem so the generators don't leave behind a bunch
// of extra files somewhere
beforeEach(async () => {
	// mock the fs module
	mock({
		// create the directory we will put the artifacts
		[testConfig().artifactDirectory]: {},
	})
})

afterEach(() => {
	mock.restore()
})

test('generates cache updaters', async function () {
	// define the schema
	const config = testConfig()

	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		// the query asks needs to ask for a field that the mutation could update
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
	const files = await fs.readdir(config.interactionDirectory)

	// make sure we made two files
	expect(files).toHaveLength(1)
	// and they have the right names
	expect(files).toEqual(
		expect.arrayContaining([
			path.basename(config.interactionPath({ query: 'TestQuery', mutation: 'TestMutation' })),
		])
	)
})

test.skip('inline fragments in mutation body count as an intersection', function () {})

test.skip('inline fragments in queries count as an intersection', function () {})

test.skip('inline fragments in fragments count as an intersection', function () {})

test.skip('fragment spread in mutation body', function () {})

test.skip("nested objects that don't have id should also update", function () {})
