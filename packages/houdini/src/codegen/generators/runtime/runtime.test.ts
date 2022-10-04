import type { ProgramKind } from 'ast-types/gen/kinds'
import path from 'path'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
import { test, expect } from 'vitest'

import { runPipeline } from '../..'
import { fs } from '../../../lib'
import { testConfig } from '../../../test'

test('cache index runtime imports config file - commonjs', async function () {
	const config = testConfig({ module: 'commonjs' })
	// execute the generator
	await runPipeline(config, [])

	// open up the index file
	const fileContents = await fs.readFile(path.join(config.runtimeDirectory, 'cache', 'index.js'))

	expect(fileContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(fileContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		"use strict";
		Object.defineProperty(exports, "__esModule", { value: true });
		const cache_1 = require("./cache");
		let cache;
		try {
		    // @ts-ignore: config will be defined by the generator
		    cache = new cache_1.Cache(config || {});
		}
		catch {
		    // @ts-ignore
		    cache = new cache_1.Cache({});
		}
		exports.default = cache;
	`)
})

test('cache index runtime imports config file - esm', async function () {
	const config = testConfig({ module: 'esm' })
	// execute the generator
	await runPipeline(config, [])

	// open up the index file
	const fileContents = await fs.readFile(path.join(config.runtimeDirectory, 'cache', 'index.js'))
	expect(fileContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(fileContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import { Cache } from './cache';
		let cache;
		try {
		    // @ts-ignore: config will be defined by the generator
		    cache = new Cache(config || {});
		}
		catch {
		    // @ts-ignore
		    cache = new Cache({});
		}
		export default cache;
	`)
})

test('updates the network file with the client path', async function () {
	const config = testConfig({ module: 'esm' })
	// execute the generator
	await runPipeline(config, [])

	// open up the index file
	const fileContents = await fs.readFile(path.join(config.runtimeDirectory, 'lib', 'network.js'))
	expect(fileContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(fileContents!, {
		parser: typeScriptParser,
	}).program

	// verify contents
	expect(recast.print(parsedQuery).code).toContain(config.client)
})

test('updates the config file with import path', async function () {
	const config = testConfig({ module: 'esm' })
	// execute the generator
	await runPipeline(config, [])

	// open up the index file
	const fileContents = await fs.readFile(path.join(config.runtimeDirectory, 'lib', 'config.js'))
	expect(fileContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(fileContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(recast.print(parsedQuery).code).toContain("import('../../../config.cjs')")
})
