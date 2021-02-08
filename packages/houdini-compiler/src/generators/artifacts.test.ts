// external imports
import path from 'path'
import { testConfig } from 'houdini-common'
import * as graphql from 'graphql'
import fs from 'fs/promises'
import mockFs from 'mock-fs'
import * as typeScriptParser from 'recast/parsers/typescript'
import { ProgramKind } from 'ast-types/gen/kinds'
import * as recast from 'recast'
// local imports
import runGenerators from '.'
import {
	CollectedGraphQLDocument,
	CompiledQueryKind,
	CompiledFragmentKind,
	CompiledDocument,
} from '../types'

// the config to use in tests
const config = testConfig()

beforeEach(() => {
	mockFs({
		[config.runtimeDirectory]: {
			[config.artifactDirectory]: {},
			[config.interactionDirectory]: {},
		},
		[__dirname]: {
			__snapshots__: mockFs.load(path.resolve(__dirname, '__snapshots__')),
		},
	})
})

// make sure the runtime directory is clear before each test
afterEach(mockFs.restore)

// the documents to test
const docs: CollectedGraphQLDocument[] = [
	{
		name: 'TestQuery',
		document: graphql.parse(`query TestQuery { version }`),
	},
	{
		name: 'TestFragment',
		document: graphql.parse(`fragment TestFragment on User { firstName }`),
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
		// load the contents of the file
		const contents = await fs.readFile(path.join(config.artifactDirectory, fileName), 'utf-8')

		// make sure there is something
		expect(contents).toBeTruthy()

		// parse the contents
		const parsedContents: ProgramKind = recast.parse(contents, {
			parser: typeScriptParser,
		}).program
		expect(parsedContents).toMatchSnapshot()
	}
})
