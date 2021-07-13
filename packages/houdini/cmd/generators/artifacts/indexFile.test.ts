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
import { CollectedGraphQLDocument } from '../../types'
import { mockCollectedDoc } from '../../testUtils'

// the config to use in tests
const config = testConfig()

// the documents to test
const docs: CollectedGraphQLDocument[] = [
	mockCollectedDoc(`query TestQuery { version }`),
	mockCollectedDoc(`fragment TestFragment on User { firstName }`),
]

test('index file - kit', async function () {
	const config = testConfig({ mode: 'kit' })

	// execute the generator
	await runPipeline(config, docs)

	// open up the index file
	const queryContents = await fs.readFile(
		path.join(config.artifactDirectory, 'index.js'),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		export { default as TestQuery} from './TestQuery'
		export { default as TestFragment} from './TestFragment'
	`)
})

test('index file - sapper', async function () {
	// execute the generator
	await runPipeline(testConfig({ mode: 'sapper' }), docs)

	// open up the index file
	const queryContents = await fs.readFile(
		path.join(config.artifactDirectory, 'index.js'),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
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
		var TestQuery = require("./TestQuery");
		Object.defineProperty(exports, "TestQuery", { enumerable: true, get: function () { return __importDefault(TestQuery).default; } });
		var TestFragment = require("./TestFragment");
		Object.defineProperty(exports, "TestFragment", { enumerable: true, get: function () { return __importDefault(TestFragment).default; } });
	`)
})
