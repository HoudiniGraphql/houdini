import type { ProgramKind } from 'ast-types/lib/gen/kinds'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
import { test, expect } from 'vitest'

import { runPipeline } from '../..'
import { fs, path } from '../../../lib'
import { testConfig, mockCollectedDoc } from '../../../test'

test('overloaded definitions for graphql functions keep original spacing', async function () {
	const originalContent = `query TestQuery { 	 version }`

	// the documents to test
	const docs = [
		mockCollectedDoc(originalContent),
		mockCollectedDoc(`fragment TestFragment on User { firstName }`),
	]

	const config = testConfig()
	config.plugins = [
		{
			name: 'pluginWithClientPlugin',
			filepath: '',
			graphqlTagReturn(args) {
				return 'hello'
			},
		},
	]

	// execute the generator
	await runPipeline(config, docs)

	// open up the index file
	const queryContents = await fs.readFile(path.join(config.runtimeDirectory, 'index.d.ts'))
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import type { Cache as InternalCache } from "./cache/cache";
		import type { CacheTypeDef } from "./generated";
		import { Cache } from "./public";
		export * from "./client";
		export * from "./lib";
		export function graphql(str: ""): hello;
		export function graphql(str: "fragment TestFragment on User { firstName }"): hello;
		export function graphql(str: "query TestQuery { \\t version }"): hello;
		export declare function graphql<_Payload>(str: TemplateStringsArray): _Payload;
		export declare const cache: Cache<CacheTypeDef>;
		export declare function getCache(): InternalCache;
	`)
})
