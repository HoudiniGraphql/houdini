import { createServerAdapter as createAdapter } from '@whatwg-node/server'
import { type GraphQLSchema, parse, execute } from 'graphql'
import { createYoga } from 'graphql-yoga'
import type { IncomingMessage, ServerResponse } from 'node:http'

// @ts-ignore
import client from '../../../src/+client'
// @ts-ignore
import { localApiSessionKeys, localApiEndpoint, getCurrentConfig } from '../lib/config'
import { find_match } from './match'
// @ts-ignore
import { get_session, handle_request } from './session'
import type { RouterManifest, RouterPageManifest, YogaServerOptions } from './types'

// load the plugin config
const config_file = getCurrentConfig()
const session_keys = localApiSessionKeys(config_file)
const graphqlEndpoint = localApiEndpoint(config_file)

export const serverAdapterFactory = <ComponentType>({
	schema,
	yoga,
	production,
	manifest,
	on_render,
	pipe,
	assetPrefix,
}: {
	schema?: GraphQLSchema | null
	yoga?: ReturnType<typeof createYoga> | null
	assetPrefix: string
	production?: boolean
	pipe?: ServerResponse<IncomingMessage>
	on_render: (args: {
		url: string
		match: RouterPageManifest<ComponentType> | null
		manifest: RouterManifest<unknown>
		session: App.Session
		pipe?: ServerResponse<IncomingMessage>
	}) => Response | Promise<Response>
	manifest: RouterManifest<ComponentType> | null
} & Omit<YogaServerOptions, 'schema'>): ReturnType<typeof createAdapter> => {
	if (schema && !yoga) {
		yoga = createYoga({
			schema,
			landingPage: !production,
			graphqlEndpoint,
		})
	}

	// @ts-ignore: schema is defined dynamically
	if (schema) {
		// @ts-ignore: graphqlEndpoint is defined dynamically
		client.registerProxy(graphqlEndpoint, async ({ query, variables, session }) => {
			// get the parsed query
			const parsed = parse(query)

			// @ts-ignore: schema is defined dynamically
			return await execute(schema, parsed, null, session, variables)
		})
	}

	return createAdapter(async (request) => {
		if (!manifest) {
			return new Response(
				"Adapter did not provide the project's manifest. Please open an issue on github.",
				{ status: 500 }
			)
		}

		// pull out the desired url
		const url = new URL(request.url).pathname

		// if its a request we can process with yoga, do it.
		if (yoga && url === localApiEndpoint(config_file)) {
			return yoga(request)
		}

		// maybe its a session-related request
		const authResponse = await handle_request({
			url,
			config: config_file,
			session_keys,
			headers: request.headers,
		})
		if (authResponse) {
			return authResponse
		}

		// the request is for a server-side rendered page

		// find the matching url
		const [match] = find_match(manifest, url)

		// call the framework-specific render hook with the latest session
		const rendered = await on_render({
			url,
			match,
			session: await get_session(request.headers, session_keys),
			manifest,
			pipe,
		})
		if (rendered) {
			console.log(url, rendered)
			return rendered
		}

		// if we got this far its not a page we recognize
		return new Response('404', { status: 404 })
	})
}

export type ServerAdapterFactory = typeof serverAdapterFactory
