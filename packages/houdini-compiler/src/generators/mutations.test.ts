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
		[testConfig({}).artifactDirectory]: {},
	})
})

afterEach(() => {
	mock.restore()
})

test('generates cache updaters', async function () {
	// define the schema
	const config = testConfig({
		schema: `
            type Query {
                user: User!
            }

            type Mutation {
                updateUser: User!
            }
        `,
	})

	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		// the query asks needs to ask for a field that the mutation could update
		{
			name: 'TestQuery',
			document: graphql.parse(`{ query TestQuery { user { id firstName } } }`),
		},
		{
			name: 'TestMutation',
			document: graphql.parse(`mutation TestMutation { updateUser { id firstName } }`),
		},
	]

	// run the generators
	await runGenerators(config, docs)
})
