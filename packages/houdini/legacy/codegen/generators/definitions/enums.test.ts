import type { ProgramKind } from 'ast-types/lib/gen/kinds'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
import { test, expect } from 'vitest'

import { runPipeline } from '../..'
import { fs, path } from '../../../../lib'
import { testConfig } from '../../../test'

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
		type ValuesOf<T> = T[keyof T]

		export declare const DedupeMatchMode: {
		    readonly Variables: "Variables";
		    readonly Operation: "Operation";
		    readonly None: "None";
		}

		export type DedupeMatchMode$options = ValuesOf<typeof DedupeMatchMode>

		/** Documentation of testenum1 */
		export declare const TestEnum1: {
		    /** Documentation of Value1 */
		    readonly Value1: "Value1";
		    /** Documentation of Value2 */
		    readonly Value2: "Value2";
		}

		/** Documentation of testenum1 */
		export type TestEnum1$options = ValuesOf<typeof TestEnum1>

		/** Documentation of testenum2 */
		export declare const TestEnum2: {
		    readonly Value3: "Value3";
		    readonly Value2: "Value2";
		}

		/** Documentation of testenum2 */
		export type TestEnum2$options = ValuesOf<typeof TestEnum2>
	`)

	// load the contents of the type definitions file
	fileContents = await fs.readFile(path.join(config.enumRuntimeDefinitionsPath))

	expect(fileContents).toBeTruthy()
	parsedQuery = recast.parse(fileContents!.toString(), {
		parser: typeScriptParser,
	}).program

	expect(parsedQuery).toMatchInlineSnapshot(`
		/** Documentation of testenum1 */
		export const TestEnum1 = {
		    /**
		     * Documentation of Value1
		    */
		    "Value1": "Value1",

		    /**
		     * Documentation of Value2
		    */
		    "Value2": "Value2"
		};

		/** Documentation of testenum2 */
		export const TestEnum2 = {
		    "Value3": "Value3",
		    "Value2": "Value2"
		};

		export const DedupeMatchMode = {
		    "Variables": "Variables",
		    "Operation": "Operation",
		    "None": "None"
		};
	`)
})
