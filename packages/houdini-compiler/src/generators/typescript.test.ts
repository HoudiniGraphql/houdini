// external imports
import path from 'path'
import { testConfig } from 'houdini-common'
import * as graphql from 'graphql'
import fs from 'fs/promises'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
// local imports
import '../../../../jest.setup'
import { runPipeline } from '../compile'

// the config to use in tests
const config = testConfig()

test('fragment types', async function () {
	// the document to test
	const doc = {
		name: 'TestFragment',
		document: graphql.parse(`fragment TestFragment on User { firstName }`),
		originalDocument: graphql.parse(`fragment TestFragment on User { firstName }`),
		filename: 'fragment.ts',
		printed: `fragment TestFragment on User { firstName }`,
	}

	// execute the generator
	await runPipeline(config, [doc])

	// look up the files in the artifact directory
	const fileContents = await fs.readFile(config.artifactTypePath(doc.document), 'utf-8')

	// make sure they match what we expect
	expect(
		recast.parse(fileContents, {
			parser: typeScriptParser,
		})
	).toMatchInlineSnapshot(`
		export type TestFragment = {
		    readonly "shape": TestFragment$data
		};

		export type TestFragment$data = {
		    firstName: string
		};
	`)
})
