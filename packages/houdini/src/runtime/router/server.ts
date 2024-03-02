import { createServerAdapter as createAdapter } from '@whatwg-node/server'
import { type GraphQLSchema, parse, execute } from 'graphql'
import { createYoga } from 'graphql-yoga'

import type { HoudiniClient } from '../client'
import { localApiSessionKeys, localApiEndpoint, getCurrentConfig } from '../lib/config'
import { find_match } from './match'
import { get_session, handle_request } from './session'
import type { RouterManifest, RouterPageManifest, YogaServerOptions } from './types'

// load the plugin config
const config_file = getCurrentConfig()
const session_keys = localApiSessionKeys(config_file)

export function _serverHandler<ComponentType = unknown>({
	schema,
	yoga,
	client,
	production,
	manifest,
	graphqlEndpoint,
	on_render,
	componentCache,
}: {
	schema?: GraphQLSchema | null
	yoga?: ReturnType<typeof createYoga> | null
	client: HoudiniClient
	production: boolean
	manifest: RouterManifest<ComponentType> | null
	assetPrefix: string
	graphqlEndpoint: string
	componentCache: Record<string, any>
	on_render: (args: {
		url: string
		match: RouterPageManifest<ComponentType> | null
		manifest: RouterManifest<unknown>
		session: App.Session
		componentCache: Record<string, any>
	}) => Response | Promise<Response | undefined> | undefined
} & Omit<YogaServerOptions, 'schema'>) {
	if (schema && !yoga) {
		yoga = createYoga({
			schema,
			landingPage: !production,
			graphqlEndpoint,
		})
	}

	client.componentCache = componentCache

	// @ts-ignore: schema is defined dynamically
	if (schema) {
		client.registerProxy(graphqlEndpoint, async ({ query, variables, session }) => {
			// get the parsed query
			const parsed = parse(query)

			return await execute(schema, parsed, null, session, variables)
		})
	}

	return async (request: Request) => {
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

		return new Response('OK', { status: 200 })
	}
}

// 	// 	// maybe its a session-related request
// 	// 	const authResponse = await handle_request({
// 	// 		url,
// 	// 		config: config_file,
// 	// 		session_keys,
// 	// 		headers: request.headers,
// 	// 	})
// 	// 	if (authResponse) {
// 	// 		return authResponse
// 	// 	}

// 	// 	// the request is for a server-side rendered page

// 	// 	// find the matching url
// 	// 	const [match] = find_match(manifest, url)

// 	// 	// call the framework-specific render hook with the latest session
// 	// 	const rendered = await on_render({
// 	// 		url,
// 	// 		match,
// 	// 		session: await get_session(request.headers, session_keys),
// 	// 		manifest,
// 	// 		componentCache,
// 	// 	})
// 	// 	if (rendered) {
// 	// 		return rendered
// 	// 	}

// 	// 	// if we got this far its not a page we recognize
// 	// 	return new Response('404', { status: 404 })
// 	// }
// }

// export const serverAdapterFactory = (
// 	args: Parameters<typeof _serverHandler>[0]
// ): ReturnType<typeof createAdapter> => {
// 	return createAdapter(_serverHandler(args))
// }

// export type ServerAdapterFactory = typeof serverAdapterFactory
