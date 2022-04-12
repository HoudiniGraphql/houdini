// external imports
import path from 'path'
import fs from 'fs/promises'
import * as typeScriptParser from 'recast/parsers/typescript'
import { ProgramKind } from 'ast-types/gen/kinds'
import * as recast from 'recast'
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
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(fileContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		var config = require('../../../../../config.cjs');var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __export = (target, all) => {
		  for (var name in all)
		    __defProp(target, name, { get: all[name], enumerable: true });
		};
		var __copyProps = (to, from, except, desc) => {
		  if (from && typeof from === "object" || typeof from === "function") {
		    for (let key of __getOwnPropNames(from))
		      if (!__hasOwnProp.call(to, key) && key !== except)
		        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
		  }
		  return to;
		};
		var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
		var cache_exports = {};
		__export(cache_exports, {
		  default: () => cache_default
		});
		module.exports = __toCommonJS(cache_exports);
		var import_cache = require("./cache");
		let cache;
		try {
		  cache = new import_cache.Cache(config || {});
		} catch {
		  cache = new import_cache.Cache({});
		}
		var cache_default = cache;
		// Annotate the CommonJS export names for ESM import in node:
		0 && (module.exports = {});
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
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(fileContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import config from "../../../config.cjs"
		import { Cache } from "./cache";
		let cache;
		try {
		  cache = new Cache(config || {});
		} catch {
		  cache = new Cache({});
		}
		var cache_default = cache;
		export {
		  cache_default as default
		};
	`)
})
