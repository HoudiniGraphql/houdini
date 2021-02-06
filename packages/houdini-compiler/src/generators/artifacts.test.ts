// external imports
import mock from 'mock-fs'
import path from 'path'
import { testConfig } from 'houdini-common'
import * as graphql from 'graphql'
import fs from 'fs/promises'
// local imports
import runGenerators from '.'
import {
	CollectedGraphQLDocument,
	CompiledQueryKind,
	CompiledFragmentKind,
	CompiledDocument,
} from '../types'

// the config to use in tests
const config = testConfig({
	runtimeDirectory: path.resolve('./generated'),
})

// we need to make sure to mock out the filesystem so the generators don't leave behind a bunch
// of extra files somewhere
beforeEach(async () => {
	// mock the fs module
	mock({
		// create the directory we will put the artifacts
		[config.artifactDirectory]: {},
	})
})

afterEach(() => {
	mock.restore()
})

// the documents to test
const docs: CollectedGraphQLDocument[] = [
	{
		name: 'TestQuery',
		document: graphql.parse(`{ query { version } }`),
	},
	{
		name: 'TestFragment',
		document: graphql.parse(`fragment Foo on User { version }`),
	},
]

test('generates an artifact for every document', async function () {
	// execute the generator
	await runGenerators(config, docs)

	// look up the files in the artifact directory
	const files = await fs.readdir(config.artifactDirectory)

	// make sure we made two files
	expect(files).toHaveLength(2)
	// and they have the right names
	expect(files).toEqual(expect.arrayContaining(['TestQuery.js', 'TestFragment.js']))
})

test('adds kind, name, and raw', async function () {
	// execute the generator
	await runGenerators(config, docs)

	// look at the files in the artifact directory
	for (const fileName of await fs.readdir(config.artifactDirectory)) {
		// import the artifact
		const artifact = (await require(path.join(
			config.artifactDirectory,
			fileName
		))) as CompiledDocument

		// if we are looking at the query
		if (artifact.name === 'TestQuery') {
			expect(artifact.kind).toEqual(CompiledQueryKind)
			expect(artifact.raw).toEqual(graphql.print(graphql.parse(`{ query { version } }`)))
		}
		// otherwise we are looking at the fragment definition
		else if (artifact.name === 'TestFragment') {
			expect(artifact.kind).toEqual(CompiledFragmentKind)
			expect(artifact.raw).toEqual(
				graphql.print(graphql.parse(`fragment Foo on User { version }`))
			)
		}
	}
})
