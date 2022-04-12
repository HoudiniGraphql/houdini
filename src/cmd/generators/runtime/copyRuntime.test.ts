// external imports
import path from 'path'
import fs from 'fs/promises'
import * as ts from 'typescript'
// local imports
import { testConfig } from '../../../common'
import '../../../../jest.setup'
import { runPipeline } from '../../generate'

test('cache index runtime imports config file - commonjs', async function () {
	const config = testConfig({ framework: 'sapper', module: 'commonjs' })
	// execute the generator
	await runPipeline(config, [])

	// open up the index file
	const fileContents = await fs.readFile(
		path.join(config.runtimeDirectory, 'cache', 'index.js'),
		'utf-8'
	)
	expect(fileContents).toBeTruthy()
	// verify contents
	expect(
		ts.transpileModule(fileContents, { compilerOptions: { module: ts.ModuleKind.CommonJS } })
	).toMatchInlineSnapshot(`
		var config = require('../../../../../config.cjs');
		Object.defineProperty(exports, "__esModule", { value: true });
		var cache_1 = require("./cache");
		var cache;
		try {
		    // @ts-ignore: config will be defined by the generator
		    cache = new cache_1.Cache(config || {});
		}
		catch (_a) {
		    // @ts-ignore
		    cache = new cache_1.Cache({});
		}
		exports.default = cache;
	`)
})

test('cache index runtime imports config file - kit', async function () {
	const config = testConfig({ module: 'esm', framework: 'kit' })
	// execute the generator
	await runPipeline(config, [])

	// open up the index file
	const fileContents = await fs.readFile(
		path.join(config.runtimeDirectory, 'cache', 'index.js'),
		'utf-8'
	)
	expect(fileContents).toBeTruthy()
	// verify contents
	expect(
		ts.transpileModule(fileContents, { compilerOptions: { module: ts.ModuleKind.CommonJS } })
	).toMatchInlineSnapshot(`
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
