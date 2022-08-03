import { ProgramKind } from 'ast-types/gen/kinds'
import path from 'path'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'

import '../../../../jest.setup'
import { readFile } from '../../../common/fs'
import { testConfig } from '../../../common/tests'
import { runPipeline } from '../../generate'

test('cache index runtime imports config file - commonjs', async function () {
	const config = testConfig({ module: 'commonjs' })
	// execute the generator
	await runPipeline(config, [])

	// open up the index file
	const fileContents = await readFile(path.join(config.runtimeDirectory, 'cache', 'index.js'))

	expect(fileContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(fileContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		var config = require('../../../config.cjs');
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
	const fileContents = await readFile(path.join(config.runtimeDirectory, 'cache', 'index.js'))
	expect(fileContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(fileContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import config from "../../../config.cjs"
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
