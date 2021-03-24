// external imports
import { testConfig } from 'houdini-common'
import fs from 'fs/promises'
import path from 'path'
import * as typeScriptParser from 'recast/parsers/typescript'
import { ProgramKind } from 'ast-types/gen/kinds'
import * as recast from 'recast'
// local imports
import '../../../../../jest.setup'
import { runPipeline } from '../../compile'
import { CollectedGraphQLDocument } from '../../types'
import { mockCollectedDoc } from '../../testUtils'

// the config to use in tests
const config = testConfig()

test('subscription constructor', async function () {
	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		mockCollectedDoc(
			'Subscription B',
			`subscription B { 
                newUser { 
                    user { 
                        firstName
                    }
                } 
            }`
		),
	]

	// execute the generator
	await runPipeline(config, docs)

	// load the contents of the file
	const contents = recast.parse(
		await fs.readFile(path.join(config.runtimeDirectory, 'environment.js'), 'utf-8'),
		{
			parser: typeScriptParser,
		}
	).program
	// verify contents
	expect(contents).toMatchInlineSnapshot(`
		"use strict";
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.Environment = void 0;
		var Environment = /** @class */ (function () {
		    // this project uses subscriptions so make sure one is passed when constructing an environment
		    function Environment(networkFn, subscriptionHandler) {
		        this.fetch = networkFn;
		        this.subscription = subscriptionHandler;
		    }
		    Environment.prototype.sendRequest = function (ctx, params, session) {
		        // @ts-ignore
		        return this.fetch.call(ctx, params, session);
		    };
		    return Environment;
		}());
		exports.Environment = Environment;
	`)

	// load the contents of the typedefs
	const typedefs = recast.parse(
		await fs.readFile(path.join(config.runtimeDirectory, 'environment.d.ts'), 'utf-8'),
		{
			parser: typeScriptParser,
		}
	).program
	// verify typedefs
	expect(typedefs).toMatchInlineSnapshot(`
		import { SubscriptionHandler } from './network';
		import { RequestHandler, FetchContext, FetchParams, FetchSession } from './network';
		export declare class Environment {
		    private fetch;
		    subscription: SubscriptionHandler;
		    constructor(networkFn: RequestHandler, subscriptionHandler: SubscriptionHandler);
		    sendRequest(ctx: FetchContext, params: FetchParams, session?: FetchSession): any;
		}
		//# sourceMappingURL=environment.d.ts.map
	`)
})

test('constructor without subscriptions', async function () {
	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		mockCollectedDoc('TestQuery', `query TestQuery { version }`),
		mockCollectedDoc('TestFragment', `fragment TestFragment on User { firstName }`),
	]

	// execute the generator
	await runPipeline(config, docs)

	// load the contents of the file
	const contents = recast.parse(
		await fs.readFile(path.join(config.runtimeDirectory, 'environment.js'), 'utf-8'),
		{
			parser: typeScriptParser,
		}
	).program
	// verify contents
	expect(contents).toMatchInlineSnapshot(`
		"use strict";
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.Environment = void 0;
		var Environment = /** @class */ (function () {
		    function Environment(networkFn) {
		        this.fetch = networkFn;
		    }
		    Environment.prototype.sendRequest = function (ctx, params, session) {
		        // @ts-ignore
		        return this.fetch.call(ctx, params, session);
		    };
		    return Environment;
		}());
		exports.Environment = Environment;
	`)

	// load the contents of the typedefs
	const typedefs = recast.parse(
		await fs.readFile(path.join(config.runtimeDirectory, 'environment.d.ts'), 'utf-8'),
		{
			parser: typeScriptParser,
		}
	).program
	// verify typedefs
	expect(typedefs).toMatchInlineSnapshot(`
		import { RequestHandler, FetchContext, FetchParams, FetchSession } from './network';
		export declare class Environment {
		    private fetch;
		    constructor(networkFn: RequestHandler);
		    sendRequest(ctx: FetchContext, params: FetchParams, session?: FetchSession): any;
		}
		//# sourceMappingURL=environment.d.ts.map
	`)
})
