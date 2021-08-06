// external imports
import path from 'path'
import { testConfig } from 'houdini-common'
import fs from 'fs/promises'
import * as typeScriptParser from 'recast/parsers/typescript'
import { ProgramKind } from 'ast-types/gen/kinds'
import * as recast from 'recast'
// local imports
import '../../../../../jest.setup'
import { runPipeline } from '../../generate'

test('cache index runtime imports config file - commonjs', async function () {
	const config = testConfig({ mode: 'sapper' })
	// execute the generator
	await runPipeline(config, [])

	// open up the index file
	const fileContents = await fs.readFile(
		path.join(config.runtimeDirectory, 'cache', 'index.js'),
		'utf-8'
	)
	expect(fileContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(fileContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		var config = require('../../../../../config.cjs');
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.createCache = void 0;
		var cache_1 = require("./cache");
		function createCache() {
		    // @ts-ignore: config will be defined by the generator
		    return new cache_1.Cache(config || {});
		}
		exports.createCache = createCache;
	`)
})

test('cache index runtime imports config file - kit', async function () {
	const config = testConfig({ mode: 'kit' })
	// execute the generator
	await runPipeline(config, [])

	// open up the index file
	const fileContents = await fs.readFile(
		path.join(config.runtimeDirectory, 'cache', 'index.js'),
		'utf-8'
	)
	expect(fileContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(fileContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import config from "../../../config.cjs"
		import { Cache } from './cache';
		export function createCache() {
		    // @ts-ignore: config will be defined by the generator
		    return new Cache(config || {});
		}
	`)
})
