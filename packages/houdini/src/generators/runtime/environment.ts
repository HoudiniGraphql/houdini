// external imports
import path from 'path'
import fs from 'fs/promises'
import { Config } from 'houdini-common'
import { compile as compileTemplate } from 'handlebars'
import * as graphql from 'graphql'
// local imports
import { CollectedGraphQLDocument } from '../../types'

export default async function generateEnvironment(
	config: Config,
	docs: CollectedGraphQLDocument[]
) {
	// the contents of the environment file depends on wether we have
	// subscriptions present or not
	let subscriptions = false

	for (const { document } of docs) {
		graphql.visit(document, {
			OperationDefinition(node) {
				// if we found a subscription
				if (node.operation === 'subscription') {
					subscriptions = true
				}
			},
		})

		// if we found one, we're done
		if (subscriptions) {
			break
		}
	}

	// the location of the adapter
	const fileLocation = path.join(config.runtimeDirectory, 'environment.mjs')

	const content = environmentTemplate({
		subscriptions,
	})

	// write the index file that exports the runtime
	await fs.writeFile(fileLocation, content, 'utf-8')
}

const environmentTemplate = compileTemplate(`
{{#if subscriptions}}
import { Client } from 'graphql-ws'
{{/if}}

export class Environment {
	private handler: RequestHandler
	{{#if subscriptions}}
	socketClient: Client

	constructor(networkFn: RequestHandler, socketClient: Client) {
		this.handler = networkFn
		this.socketClient = socketClient
	}	
	{{else}}
	
	constructor(networkFn: RequestHandler) {
		this.handler = networkFn
	}	
	{{/if}}

	sendRequest(
		ctx: FetchContext,
		params: FetchParams,
		session?: FetchSession
	): Promise<RequestPayload> {
		return this.handler.call(ctx, params, session)
	}
}
`)
