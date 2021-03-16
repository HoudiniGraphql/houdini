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
	const fileContents = await fs.readFile(
		path.join(config.runtimeDirectory, 'environment.mjs'),
		'utf-8'
	)
	expect(fileContents).toBeTruthy()
	// parse the contents
	const parsedQuery = recast.parse(fileContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import { Client } from 'graphql-ws'

		export class Environment {
			private handler: RequestHandler
			socketClient: Client

			constructor(networkFn: RequestHandler, socketClient: Client) {
				this.handler = networkFn
				this.socketClient = socketClient
			}	

			sendRequest(
				ctx: FetchContext,
				params: FetchParams,
				session?: FetchSession
			): Promise<RequestPayload> {
				return this.handler.call(ctx, params, session)
			}
		}
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
	const fileContents = await fs.readFile(
		path.join(config.runtimeDirectory, 'environment.mjs'),
		'utf-8'
	)
	expect(fileContents).toBeTruthy()
	// parse the contents
	const parsedQuery = recast.parse(fileContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		export class Environment {
			private handler: RequestHandler
			
			constructor(networkFn: RequestHandler) {
				this.handler = networkFn
			}	

			sendRequest(
				ctx: FetchContext,
				params: FetchParams,
				session?: FetchSession
			): Promise<RequestPayload> {
				return this.handler.call(ctx, params, session)
			}
		}
	`)
})
