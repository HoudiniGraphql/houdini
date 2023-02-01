import type { ProgramKind } from 'ast-types/lib/gen/kinds'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
import { test, expect } from 'vitest'

import { runPipeline } from '../..'
import type { Document } from '../../../lib'
import { fs, path } from '../../../lib'
import { mockCollectedDoc, testConfig } from '../../../test'

// the config to use in tests
const config = testConfig()

test('generates runtime definitions for each enum', async function () {
	// execute the generator
	await runPipeline(config, [])

	// load the contents of the type definitions file
	let fileContents = await fs.readFile(path.join(config.enumTypesDefinitionsPath))
	expect(fileContents).toBeTruthy()
	let parsedQuery: ProgramKind = recast.parse(fileContents!.toString(), {
		parser: typeScriptParser,
	}).program

	expect(parsedQuery).toMatchInlineSnapshot(`
		export const TestEnum1 = {
		    Value1: "Value1",
		    Value2: "Value2"
		} as const
		 
		export const TestEnum2 = {
		    Value3: "Value3",
		    Value2: "Value2"
		} as const
	`)

	// load the contents of the type definitions file
	fileContents = await fs.readFile(path.join(config.enumRuntimeDefinitionsPath))

	expect(fileContents).toBeTruthy()
	parsedQuery = recast.parse(fileContents!.toString(), {
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
	`)
})
