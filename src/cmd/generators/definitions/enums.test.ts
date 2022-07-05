// external imports
import path from 'path'
import fs from 'fs/promises'
import * as typeScriptParser from 'recast/parsers/typescript'
import * as recast from 'recast'
import { ProgramKind } from 'ast-types/gen/kinds'
// local imports
import { testConfig } from '../../../common'
import '../../../../jest.setup'
import { runPipeline } from '../../generate'
import { CollectedGraphQLDocument } from '../../types'
import { mockCollectedDoc } from '../../testUtils'

// the config to use in tests
const config = testConfig()

// the documents to test
const docs: CollectedGraphQLDocument[] = [
	mockCollectedDoc(`query TestQuery { version }`),
	mockCollectedDoc(`fragment TestFragment on User { firstName }`),
]

test('generates runtime defintions for each enum', async function () {
	// execute the generator
	await runPipeline(config, [])

	// load the contents of the type definitions file
	let fileContents = await fs.readFile(path.join(config.enumTypesDefinitionsPath), 'utf-8')
	expect(fileContents).toBeTruthy()
	let parsedQuery: ProgramKind = recast.parse(fileContents.toString(), {
		parser: typeScriptParser,
	}).program

	expect(parsedQuery).toMatchInlineSnapshot(`
		export declare enum TestEnum1 {
		    Value1 = "Value1",
		    Value2 = "Value2"
		}
		 
		export declare enum TestEnum2 {
		    Value3 = "Value3",
		    Value2 = "Value2"
		}
		 
		export declare enum CachePolicy {
		    CacheAndNetwork = "CacheAndNetwork",
		    CacheOnly = "CacheOnly",
		    CacheOrNetwork = "CacheOrNetwork",
		    NetworkOnly = "NetworkOnly"
		}
	`)

	// load the contents of the type definitions file
	fileContents = await fs.readFile(path.join(config.enumRuntimeDefinitionsPath), 'utf-8')

	expect(fileContents).toBeTruthy()
	parsedQuery = recast.parse(fileContents.toString(), {
		parser: typeScriptParser,
	}).program

	expect(parsedQuery).toMatchInlineSnapshot(`
		export const TestEnum1 = {
		    "Value1": "Value1",
		    "Value2": "Value2"
		};

		export const TestEnum2 = {
		    "Value3": "Value3",
		    "Value2": "Value2"
		};

		export const CachePolicy = {
		    "CacheAndNetwork": "CacheAndNetwork",
		    "CacheOnly": "CacheOnly",
		    "CacheOrNetwork": "CacheOrNetwork",
		    "NetworkOnly": "NetworkOnly"
		};
	`)
})
