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
import { mockCollectedDoc } from '../testUtils'

// the config to use in tests
const config = testConfig()

// the documents to test
const docs: CollectedGraphQLDocument[] = [
	mockCollectedDoc('TestQuery', `query TestQuery { version }`),
	mockCollectedDoc('TestFragment', `fragment TestFragment on User { firstName }`),
]

test('generates an artifact for every document', async function () {
	// execute the generator
	await runPipeline(config, docs)

	// look up the files in the artifact directory
	const files = await fs.readdir(config.artifactDirectory)

	// and they have the right names
	expect(files).toEqual(expect.arrayContaining(['TestQuery.cjs', 'TestFragment.cjs']))
})

test('adds kind, name, and raw, and selectionInfo', async function () {
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

		module.exports.selectionInfo = {
		    rootType: "Query",

		    fields: {
		        "Query": {
		            "version": {
		                "key": "versionsomething_with_args",
		                "type": "Int"
		            }
		        }
		    }
		};
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

test('internal directives are scrubbed', async function () {
	// execute the generator
	await runPipeline(config, [
		mockCollectedDoc('Fragment', `fragment A on User { firstName }`),
		mockCollectedDoc('TestQuery', `query TestQuery { user { ...A @prepend } }`),
	])

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
		module.exports.hash = "f4887b164296c8e6be4c4461520a7f99";

		module.exports.raw = \`query TestQuery {
		  user {
		    ...A
		  }
		}

		fragment A on User {
		  firstName
		}
		\`;

		module.exports.selectionInfo = {
		    rootType: "Query",

		    fields: {
		        "Query": {
		            "user": {
		                "key": "usersomething_with_args",
		                "type": "User"
		            }
		        },

		        "User": {
		            "firstName": {
		                "key": "firstNamesomething_with_args",
		                "type": "String"
		            }
		        }
		    }
		};
	`)
})
