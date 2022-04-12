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
		var config = require('../../../../../config.cjs');var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
		var __export = (target, all) => {
		  __markAsModule(target);
		  for (var name in all)
		    __defProp(target, name, { get: all[name], enumerable: true });
		};
		var __reExport = (target, module2, desc) => {
		  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
		    for (let key of __getOwnPropNames(module2))
		      if (!__hasOwnProp.call(target, key) && key !== "default")
		        __defProp(target, key, { get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable });
		  }
		  return target;
		};
		var __toModule = (module2) => {
		  return __reExport(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? { get: () => module2.default, enumerable: true } : { value: module2, enumerable: true })), module2);
		};
		__export(exports, {
		  default: () => cache_default
		});
		var import_cache = __toModule(require("./cache"));
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
		import { createRequire as topLevelCreateRequire } from 'module'
		const require = topLevelCreateRequire(import.meta.url)
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
