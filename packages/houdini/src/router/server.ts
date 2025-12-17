import { createServerAdapter } from '@whatwg-node/server'
import type { ServerAdapterRequestHandler } from '@whatwg-node/server'
import type { GraphQLSchema } from 'graphql'
import { YogaServer, type YogaInitialContext } from 'graphql-yoga'
import type { YogaSchemaDefinition } from 'graphql-yoga/typings/plugins/use-schema'

import type { ConfigFile } from '../lib/config.js'
import type { HoudiniClient } from '../runtime/client.js'
import { serialize as encodeCookie } from './cookies'
import { find_match } from './match'
import { get_session, handle_request, session_cookie_name } from './session'
import type { RouterManifest, RouterPageManifest, YogaServerOptions } from './types'

export function _serverHandler<ComponentType = unknown>({
	schema,
	server,
	client,
	production,
	manifest,
	graphqlEndpoint,
	on_render,
	componentCache,
	config_file,
}: {
	schema?: GraphQLSchema | null
	server?: Server<any, any>
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
	config_file: ConfigFile
} & Omit<YogaServerOptions, 'schema'>) {
	const session_keys = localApiSessionKeys(config_file)

	if (schema && !server) {
		server = new Server({
			landingPage: !production,
		})
	}

	// initialize the server with the project schema and graphql endpoint
	let requestHandler: ReturnType<typeof createServerAdapter> | null = null
	if (server && schema) {
		requestHandler = server.init({
			schema: schema,
			endpoint: graphqlEndpoint,
			getSession: (request: Request) => get_session(request.headers, session_keys),
		})
	}

	client.componentCache = componentCache

	// if we have a local schema then requests to this endpoint should resolve locally using the yoga instance so we
	// inherit any context values
	if (requestHandler) {
		client.registerProxy(graphqlEndpoint, async ({ query, variables, session }) => {
			const response = await requestHandler!(
				new Request(`http://localhost/${graphqlEndpoint}`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Cookie: encodeCookie(session_cookie_name, JSON.stringify(session ?? {}), {
							httpOnly: true,
						}),
					},
					body: JSON.stringify({
						query,
						variables,
					}),
				})
			)
			return await response.json()
		})
	}

	return async (request: Request, ...extraContext: Array<any>) => {
		if (!manifest) {
			return new Response(
				"Adapter did not provide the project's manifest. Please open an issue on github.",
				{ status: 500 }
			)
		}

		// pull out the desired url
		const url = new URL(request.url).pathname

		// if its a request we can process with yoga, do it.
		if (requestHandler && url === graphqlEndpoint) {
			return requestHandler(request, ...extraContext)
		}

		// maybe its a session-related request
		const authResponse = await handle_request({
			request,
			config: config_file,
			session_keys,
		})
		if (authResponse) {
			return authResponse
		}

		// the request is for a server-side rendered page

		// find the matching url
		const [match] = find_match(config_file, manifest, url)

		// call the framework-specific render hook with the latest session
		const rendered = await on_render({
			url,
			match,
			session: await get_session(request.headers, session_keys),
			manifest,
			componentCache,
		})
		if (rendered) {
			return rendered
		}

		// if we got this far its not a page we recognize
		return new Response('404', { status: 404 })
	}
}

export const serverAdapterFactory = (
	args: Parameters<typeof _serverHandler>[0]
): ReturnType<typeof createServerAdapter> => {
	return createServerAdapter(_serverHandler(args))
}

export type ServerAdapterFactory = typeof serverAdapterFactory

function localApiSessionKeys(configFile: ConfigFile) {
	return configFile.router?.auth?.sessionKeys ?? []
}
type YogaParams = Required<ConstructorParameters<typeof YogaServer>>[0]

type ConstructorParams = Omit<YogaParams, 'schema' | 'graphqlEndpoint'>

export class Server<
	ServerContext extends Record<string, any>,
	UserContext extends Record<string, any>
> {
	opts: ConstructorParams | null

	_yoga: YogaServer<any, any> | null = null

	constructor(opts?: ConstructorParams) {
		this.opts = opts ?? null
	}

	init({
		endpoint,
		schema,
		getSession,
	}: {
		schema: YogaSchemaDefinition<any>
		endpoint: string
		getSession: (request: Request) => Promise<UserContext>
	}) {
		this._yoga = new YogaServer({
			...this.opts,
			schema: schema,
			graphqlEndpoint: endpoint,
			context: async (ctx: YogaInitialContext) => {
				const userContext = !this.opts
					? {}
					: typeof this.opts.context === 'function'
					? await this.opts.context(ctx)
					: this.opts.context || {}
				const sessionContext = (await getSession(ctx.request)) || {}
				return {
					...userContext,
					session: sessionContext,
				} as UserContext & ServerContext
			},
		})

		return createServerAdapter<ServerContext, Server<ServerContext, UserContext>>(this, {
			fetchAPI: this._yoga!.fetchAPI,
			plugins: this._yoga!['plugins'],
		})
	}

	handle: ServerAdapterRequestHandler<ServerContext> = (
		request: Request,
		serverContext: ServerContext
	) => {
		return this._yoga!.handle(request, serverContext)
	}
}
