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

	// render the template
	const content = environmentTemplate({ subscriptions })

	// copy the typescript source to the target
	await fs.writeFile(path.join(config.runtimeDirectory, 'environment.ts'), content, 'utf-8')
}

const environmentTemplate = compileTemplate(`
{{#if subscriptions}}
// @ts-ignore: i give up. the in-memory compiler can't find this module but it 
import { Client } from 'graphql-ws'
{{/if}}

import { RequestHandler, FetchContext, FetchParams,  FetchSession } from './network'

export class Environment {
	private handler: RequestHandler

	{{#if subscriptions}}
	socketClient: Client
	
	// this project uses subscriptions so make sure one is passed when constructing an environment
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
	) {
		// @ts-ignore
		return this.handler.call(ctx, params, session)
	}
}
`)
