import { ProgramKind } from 'ast-types/gen/kinds'
import path from 'path'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'

import '../../../../jest.setup'
import { readFile } from '../../../common/fs'
import { testConfig } from '../../../common/tests'
import { runPipeline } from '../../generate'
import { mockCollectedDoc } from '../../testUtils'
import { CollectedGraphQLDocument } from '../../types'

// the documents to test
const docs: CollectedGraphQLDocument[] = [
	mockCollectedDoc(`query TestQuery { version }`),
	mockCollectedDoc(`fragment TestFragment on User { firstName }`),
]

test('runtime index file - commonjs', async function () {
	const config = testConfig({ module: 'commonjs' })
	// execute the generator
	await runPipeline(config, docs)

	// open up the index file
	const queryContents = await readFile(path.join(config.rootDir, 'index.js'))
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		"use strict";
		var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
		    if (k2 === undefined) k2 = k;
		    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
		}) : (function(o, m, k, k2) {
		    if (k2 === undefined) k2 = k;
		    o[k2] = m[k];
		}));
		var __exportStar = (this && this.__exportStar) || function(m, exports) {
		    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
		};
		var __importDefault = (this && this.__importDefault) || function (mod) {
		    return (mod && mod.__esModule) ? mod : { "default": mod };
		};
		Object.defineProperty(exports, "__esModule", { value: true });

		var houdiniConfig = require("../config.cjs");
		Object.defineProperty(exports, "houdiniConfig", { enumerable: true, get: function () { return __importDefault(houdiniConfig).default; } });

		__exportStar(require("./runtime"), exports);
		__exportStar(require("./artifacts"), exports);
		__exportStar(require("./graphql"), exports);
	`)
})

test('runtime index file - esm', async function () {
	const config = testConfig({ module: 'esm' })
	// execute the generator
	await runPipeline(config, docs)

	// open up the index file
	const queryContents = await readFile(path.join(config.rootDir, 'index.js'))
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		export { default as houdiniConfig } from "../config.cjs"
		export * from "./runtime"
		export * from "./artifacts"
		export * from "./stores"
		export * from "./graphql"
	`)
})
