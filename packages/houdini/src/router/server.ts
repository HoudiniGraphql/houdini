import { createServerAdapter } from '@whatwg-node/server'
import type { ServerAdapterRequestHandler } from '@whatwg-node/server'
import type { GraphQLSchema } from 'graphql'
import {
	YogaServer,
	type YogaInitialContext,
	type YogaServerOptions as YogaConfig,
} from 'graphql-yoga'

import type { ConfigFile } from '../lib/config.js'
import type { HoudiniClient } from '../runtime/client.js'
import { serialize as encodeCookie } from './cookies.js'
import { find_match, find_prefix_match } from './match.js'
import { get_session, handle_request, session_cookie_name } from './session.js'
import type { RouterManifest, RouterPageManifest, YogaServerOptions } from './types.js'

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
		is404: boolean
		manifest: RouterManifest<unknown>
		session: App.Session
		componentCache: Record<string, any>
		headers: Record<string, string>
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

		// find the matching url; fall back to the deepest prefix match so that
		// 404 pages render inside the correct layout chain
		const [exactMatch] = find_match(config_file, manifest, url)
		const is404 = !exactMatch
		const match = exactMatch ?? find_prefix_match(manifest, url)

		// evaluate the headers() exports for this page and its layout chain so the
		// adapter can apply them before streaming begins
		const headers = await collect_response_headers(match)

		// call the framework-specific render hook with the latest session
		const rendered = await on_render({
			url,
			match,
			is404,
			session: await get_session(request.headers, session_keys),
			manifest,
			componentCache,
			headers,
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

// collect_response_headers evaluates the headers() exports for the matched page
// and its layout chain (outermost first) and merges them into a single record.
// Because the loaders are ordered outermost → page, later writes overwrite
// earlier ones, so the page wins over its layouts and an inner layout wins over
// an outer one.
export async function collect_response_headers(
	match: { headers?: Array<() => Promise<(() => unknown) | undefined>> } | null
): Promise<Record<string, string>> {
	const merged: Record<string, string> = {}
	for (const load of match?.headers ?? []) {
		const fn = await load()
		if (typeof fn !== 'function') {
			continue
		}
		const result = await fn()
		if (result && typeof result === 'object') {
			for (const [key, value] of Object.entries(result)) {
				merged[key] = String(value)
			}
		}
	}
	return merged
}

export type ServerAdapterFactory = typeof serverAdapterFactory

function localApiSessionKeys(configFile: ConfigFile) {
	return configFile.router?.auth?.sessionKeys ?? []
}
type YogaParams = Required<ConstructorParameters<typeof YogaServer>>[0]
type YogaSchemaDefinition<TContext> = NonNullable<YogaConfig<any, TContext>['schema']>

type ConstructorParams = Omit<YogaParams, 'schema' | 'graphqlEndpoint'>

export class Server<
	ServerContext extends Record<string, any>,
	UserContext extends Record<string, any>,
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
			plugins: (this._yoga! as any).plugins,
		})
	}

	handle: ServerAdapterRequestHandler<ServerContext> = (
		request: Request,
		serverContext: ServerContext
	) => {
		return this._yoga!.handle(request, serverContext)
	}
}
