// external imports
import path from 'path'
import { testConfig } from 'houdini-common'
import * as graphql from 'graphql'
import fs from 'fs/promises'
import * as typeScriptParser from 'recast/parsers/typescript'
import { ProgramKind } from 'ast-types/gen/kinds'
import * as recast from 'recast'
// local imports
import '../../../../jest.setup'
import { runPipeline } from '../compile'
import { CollectedGraphQLDocument } from '../types'

// the config to use in tests
const config = testConfig()

// the documents to test
const docs: CollectedGraphQLDocument[] = [
	{
		name: 'TestQuery',
		document: graphql.parse(`query TestQuery { version }`),
		filename: 'query.ts',
		printed: `query TestQuery { version }`,
	},
	{
		name: 'TestFragment',
		document: graphql.parse(`fragment TestFragment on User { firstName }`),
		filename: 'fragment.ts',
		printed: `fragment TestFragment on User { firstName }`,
	},
]

test('generates an artifact for every document', async function () {
	// execute the generator
	await runPipeline(config, docs)

	// look up the files in the artifact directory
	const files = await fs.readdir(config.artifactDirectory)

	// make sure we made two files
	expect(files).toHaveLength(2)
	// and they have the right names
	expect(files).toEqual(expect.arrayContaining(['TestQuery.js', 'TestFragment.js']))
})

test('adds kind, name, and raw', async function () {
	// execute the generator
	await runPipeline(config, docs)

	//
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
		module.exports.name = "TestQuery";
		module.exports.kind = "HoudiniQuery";
		module.exports.hash = "41ec892821ed25278cbbaf2c4d434205";

		module.exports.raw = \`query TestQuery {
		  version
		}
		\`;
	`)

	const fragmentContents = await fs.readFile(
		path.join(config.artifactPath(docs[1].document)),
		'utf-8'
	)
	expect(fragmentContents).toBeTruthy()
	// parse the contents
	const parsedFragment: ProgramKind = recast.parse(fragmentContents, {
		parser: typeScriptParser,
	}).program
	// and verify their content
	expect(parsedFragment).toMatchInlineSnapshot(`
		module.exports.name = "TestFragment";
		module.exports.kind = "HoudiniFragment";
		module.exports.hash = "a77288e39dcdadb70e4010b543c89c6a";

		module.exports.raw = \`fragment TestFragment on User {
		  firstName
		}
		\`;
	`)
})
