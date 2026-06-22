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
import { interpolateRedirect } from '../runtime/endpoint.js'
import { coerceFormData } from '../runtime/formData.js'
import { serialize as encodeCookie } from './cookies.js'
import { find_match, find_prefix_match } from './match.js'
import { get_session, handle_request, session_cookie_name } from './session.js'
import type { RouterManifest, RouterPageManifest, YogaServerOptions } from './types.js'

// the outcome of a no-JS form submission, keyed by form id (the mutation name, or the
// explicit @endpoint(id:)). Injected into the page tree on the error re-render so the
// submitted form renders its result/errors inline.
export type FormResult = Record<string, { data: any; errors: any }>

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
		// the result of a no-JS form submission, keyed by form id, injected on the
		// PRG error re-render so the submitted form can show its result/errors inline.
		formResult?: FormResult
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

	// renderPage runs the framework render hook for a url. Shared by the normal page path
	// and the form error re-render (which injects a formResult and forces a 4xx status).
	const renderPage = async (
		nonNullManifest: RouterManifest<ComponentType>,
		request: Request,
		url: string,
		opts?: { formResult?: FormResult; status?: number }
	): Promise<Response> => {
		// find the matching url; fall back to the deepest prefix match so that
		// 404 pages render inside the correct layout chain
		const [exactMatch] = find_match(nonNullManifest, url)
		const is404 = !exactMatch
		const match = exactMatch ?? find_prefix_match(nonNullManifest, url)

		// evaluate the headers() exports for this page and its layout chain so the
		// adapter can apply them before streaming begins
		const headers = await collect_response_headers(match)

		const rendered = await on_render({
			url,
			match,
			is404,
			session: await get_session(request.headers, session_keys),
			manifest: nonNullManifest,
			componentCache,
			headers,
			formResult: opts?.formResult,
		})
		if (!rendered) {
			// if we got this far its not a page we recognize
			return new Response('404', { status: 404 })
		}
		// the error re-render wants a 4xx; on_render builds its own (200/404) status, so
		// re-wrap the stream when an override is requested
		if (opts?.status && opts.status !== rendered.status) {
			return new Response(rendered.body, { status: opts.status, headers: rendered.headers })
		}
		return rendered
	}

	// handleForm intercepts a native (no-JS) form POST to a page url, identified by the
	// hidden __houdini_form marker. Returns null when the request isn't one of our forms so
	// the caller falls through to the normal page render.
	const handleForm = async (
		nonNullManifest: RouterManifest<ComponentType>,
		request: Request,
		parsedURL: URL,
		url: string
	): Promise<Response | null> => {
		// the graphql endpoint (JSON) and auth requests were handled already; we only want
		// native form posts here.
		if (request.method !== 'POST') {
			return null
		}
		const contentType = request.headers.get('content-type') ?? ''
		if (
			!contentType.includes('application/x-www-form-urlencoded') &&
			!contentType.includes('multipart/form-data')
		) {
			return null
		}

		// CSRF: native form posts are CORS "simple requests" that bypass preflight, so we
		// fail-closed on the Origin header (must match the app origin or the allowlist).
		const origin = request.headers.get('origin')
		const allowedOrigins = [parsedURL.origin, ...(config_file.router?.allowedOrigins ?? [])]
		if (!origin || !allowedOrigins.includes(origin)) {
			return new Response('Forbidden', { status: 403 })
		}

		const formData = await request.formData()
		const mutationName = formData.get('__houdini_form')
		if (typeof mutationName !== 'string') {
			return new Response('Bad Request', { status: 400 })
		}
		const formIdValue = formData.get('__houdini_form_id')
		const formId = typeof formIdValue === 'string' && formIdValue ? formIdValue : mutationName

		const loadArtifact = nonNullManifest.formActions?.[mutationName]
		if (!loadArtifact) {
			return new Response(`Unknown form mutation: ${mutationName}`, { status: 400 })
		}
		const handler = requestHandler
		if (!handler) {
			return new Response('Form submissions require a local GraphQL server', { status: 500 })
		}

		const { default: artifact } = await loadArtifact()

		// coerce the body into variables and run the mutation through the local yoga proxy,
		// inheriting the session
		const input = artifact.input ?? { fields: {}, types: {}, defaults: {}, runtimeScalars: {} }
		const variables = coerceFormData(formData, input, config_file)
		const session = await get_session(request.headers, session_keys)
		const response = await handler(
			new Request(`http://localhost/${graphqlEndpoint}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Cookie: encodeCookie(session_cookie_name, JSON.stringify(session ?? {}), {
						httpOnly: true,
					}),
				},
				body: JSON.stringify({ query: artifact.raw, variables }),
			})
		)
		const result = (await response.json()) as { data?: any; errors?: any[] }

		// errors → re-render the page inline (a redirect would hide them). a refresh on an
		// error re-submits, which is the accepted, universal behavior.
		if (result.errors && result.errors.length > 0) {
			return renderPage(nonNullManifest, request, url, {
				formResult: { [formId]: { data: result.data ?? null, errors: result.errors } },
				status: 422,
			})
		}

		// success → 303 so a refresh can't resubmit. redirect to the interpolated @endpoint
		// target when present, else PRG back to the page.
		let location = url
		const redirect = artifact.endpoint?.redirect
		if (redirect) {
			const target = interpolateRedirect(redirect, result.data)
			if (target) {
				location = target
			} else if (!production) {
				console.warn(
					`@endpoint redirect for "${mutationName}" resolved to a null value; falling back to the current page`
				)
			}
		}
		return new Response(null, { status: 303, headers: { Location: location } })
	}

	return async (request: Request, ...extraContext: Array<any>) => {
		if (!manifest) {
			return new Response(
				"Adapter did not provide the project's manifest. Please open an issue on github.",
				{ status: 500 }
			)
		}

		// pull out the desired url. keep the query string so search params survive into
		// find_match and the server-rendered initialURL; match the graphql endpoint on the
		// pathname alone.
		const parsedURL = new URL(request.url)
		const url = parsedURL.pathname + parsedURL.search

		// if its a request we can process with yoga, do it.
		if (requestHandler && parsedURL.pathname === graphqlEndpoint) {
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

		// maybe it's a native (no-JS) form submission to this page's url
		const formResponse = await handleForm(manifest, request, parsedURL, url)
		if (formResponse) {
			return formResponse
		}

		// otherwise it's a request for a server-side rendered page
		return renderPage(manifest, request, url)
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
