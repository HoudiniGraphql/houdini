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
import { interpolateRedirect, valueAtPath } from '../runtime/endpoint.js'
import { coerceFormData } from '../runtime/formData.js'
import { buildGraphQLBody } from '../runtime/multipart.js'
import { marshalInputs } from '../runtime/scalars.js'
import { CSRF_FIELD, signFormToken, verifyFormToken, signSessionToken } from './auth-token.js'
import { serialize as encodeCookie } from './cookies.js'
import { find_match, find_prefix_match } from './match.js'
import {
	clear_session,
	get_session,
	handle_request,
	session_cookie_name,
	set_session,
} from './session.js'
import type { RouterManifest, RouterPageManifest, YogaServerOptions } from './types.js'

// re-exported for tests that mint tokens through the real path
export { signFormToken }

// the outcome of a no-JS form submission, keyed by form id (the mutation name, or the
// explicit @endpoint(id:)). Injected into the page tree on the error re-render so the
// submitted form renders its result/errors inline.
export type FormResult = Record<string, { data: any; errors: any }>

// a header the Houdini client always sets (see fetch.ts) and a cross-origin CORS-simple
// request cannot. Required for CORS-simple POSTs to the graphql endpoint so they can't be a
// CSRF channel. Must stay in sync with the header set in fetch.ts.
const HOUDINI_REQUEST_HEADER = 'x-houdini-request'

// sessionMintPlugin is the server side of the enhanced @session path. After a session mutation
// (any @session mutation, form or not) executes over GraphQL it mints a server-signed token of
// the resolver's session subtree into `extensions.houdiniSession`. The client relays that
// token to the auth endpoint, which verifies and sets the cookie — so the value that becomes
// the session is always server-authoritative (the client can't forge a signed token). It
// keys off the manifest's sessionMutations (name → sessionPath), independent of forms.
function sessionMintPlugin(manifest: RouterManifest<any> | null, sessionKeys: string[]): any {
	return {
		onExecute() {
			return {
				async onExecuteDone({ args, result, setResult }: any) {
					// only single results carry a session subtree (skip streamed responses)
					if (
						!result ||
						typeof result[Symbol.asyncIterator] === 'function' ||
						!result.data
					) {
						return
					}
					// the no-JS form handler runs the mutation through this same Yoga and sets the
					// cookie directly from the result, so a token here would be minted and thrown
					// away. It marks its internal request with a header; skip those.
					if (args?.contextValue?.request?.headers?.get(INTERNAL_FORM_HEADER)) {
						return
					}
					// a failed @session mutation must never touch the session — auth failure is
					// signalled by a GraphQL error, and only a *successful* execution mints a token.
					if (result.errors?.length) {
						return
					}
					const name = operationNameOf(args)
					const session = name ? manifest?.sessionMutations?.[name] : undefined
					if (!session) {
						return
					}
					// on success: a non-null value writes the session (merge or replace per the
					// directive); a null one clears it (logout — e.g. a server-side logout mutation
					// whose session field comes back null). signSessionToken encodes which action,
					// so the client just relays it. Bind the token to the session the mutation ran
					// under (sid) so a leaked token can't be replayed from a different session.
					const value = valueAtPath(result.data, session.sessionPath.split('.'))
					const priorSession = await get_session(
						args.contextValue.request.headers,
						sessionKeys
					)
					const token = await signSessionToken(
						(value ?? null) as App.Session | null,
						sessionKeys,
						session.merge,
						priorSession
					)
					setResult({
						...result,
						extensions: { ...result.extensions, houdiniSession: token },
					})
				},
			}
		},
	}
}

// a header the no-JS form handler sets on its internal GraphQL request so the session-mint
// plugin can skip it (the handler writes the cookie itself).
const INTERNAL_FORM_HEADER = 'x-houdini-internal-form'

// operationNameOf resolves the executed operation's name from the envelop args. The client
// proxy doesn't send an explicit operationName, so fall back to the document's operation
// definition — but only when there's exactly one, so we never guess the wrong operation in a
// (Houdini-impossible today) multi-operation document.
function operationNameOf(args: any): string | null {
	if (args?.operationName) {
		return args.operationName
	}
	const ops = (args?.document?.definitions ?? []).filter(
		(def: any) => def.kind === 'OperationDefinition'
	)
	if (ops.length === 1 && ops[0].name?.value) {
		return ops[0].name.value
	}
	return null
}

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
		// the signed CSRF token forms render in a hidden field (only when router.formToken
		// is enabled); undefined otherwise.
		formToken?: string
	}) => Response | Promise<Response | undefined> | undefined
	config_file: ConfigFile
} & Omit<YogaServerOptions, 'schema'>) {
	const session_keys = localApiSessionKeys(config_file)

	// fall back to a random per-process key when none are configured, so both auth sessions
	// and form CSRF tokens work out of the box. Configuring session keys is about
	// persistence — surviving redeploys and verifying across a load-balanced fleet — not
	// about turning these on. (Random key ⇒ sessions/tokens don't survive a restart, which
	// is fine in dev/single-server; production should configure keys.)
	if (session_keys.length === 0) {
		session_keys.push(crypto.randomUUID())
	}

	if (schema && !server) {
		server = new Server({
			landingPage: !production,
		})
	}

	// the enhanced (post-hydration) @session path needs a Yoga plugin that mints a server-signed
	// token of a session mutation's subtree into the response extensions (so the client can
	// relay it without ever seeing or forging the value). Attach it to whatever Server we use —
	// created above OR provided by an adapter — by merging into its opts before init, so the
	// path can never silently break depending on how the server was supplied.
	if (server instanceof Server) {
		server.opts = {
			...(server.opts ?? {}),
			plugins: [...(server.opts?.plugins ?? []), sessionMintPlugin(manifest, session_keys)],
		}
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

		// mint the session-bound token forms render in their hidden CSRF field
		const session = await get_session(request.headers, session_keys)
		const formToken = await signFormToken(session, session_keys)

		const rendered = await on_render({
			url,
			match,
			is404,
			session,
			manifest: nonNullManifest,
			componentCache,
			headers,
			formResult: opts?.formResult,
			formToken,
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

		// DoS guard: reject an over-large body before buffering it. (A chunked body with no
		// Content-Length falls through to the host/proxy limit.)
		const maxBodyBytes = config_file.router?.formMaxBodyBytes ?? 10 * 1024 * 1024
		const contentLength = Number(request.headers.get('content-length'))
		if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
			return new Response('Payload Too Large', { status: 413 })
		}

		const formData = await request.formData()

		// hardened CSRF: the form must carry a token we signed at render time — bound to
		// THIS session, time-limited, purpose-claimed, and signed with a key domain-separated
		// from the session cookie. A cross-origin page can't read it, so it can't forge one.
		const session = await get_session(request.headers, session_keys)
		if (!(await verifyFormToken(formData.get(CSRF_FIELD), session, session_keys))) {
			return new Response('Forbidden', { status: 403 })
		}
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

		// coerce the body into rich variables, then marshal them to transport form exactly
		// like the client's send does (so custom scalars — e.g. a Date — go over the wire in
		// the shape the schema expects, not their default JSON serialization). When the form
		// carried files the values are File objects, which marshalInputs leaves untouched and
		// buildGraphQLBody turns into a multipart request (else plain JSON).
		const input = artifact.input ?? { fields: {}, types: {}, defaults: {}, runtimeScalars: {} }
		const coerced = coerceFormData(formData, input, config_file, artifact.endpoint?.fields)
		const variables = (marshalInputs({ artifact, input: coerced, config: config_file }) ??
			{}) as Record<string, any>
		const { contentType: bodyContentType, body } = buildGraphQLBody(artifact.raw, variables)
		const response = await handler(
			new Request(`http://localhost/${graphqlEndpoint}`, {
				method: 'POST',
				headers: {
					...(bodyContentType ? { 'Content-Type': bodyContentType } : {}),
					// mark this as the no-JS form's internal execution so the session-mint plugin
					// skips it (we set the cookie directly below)
					[INTERNAL_FORM_HEADER]: '1',
					Cookie: encodeCookie(session_cookie_name, JSON.stringify(session ?? {}), {
						httpOnly: true,
					}),
				},
				body,
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
		const formResponse = new Response(null, { status: 303, headers: { Location: location } })

		// progressively-enhanced auth: when the submitted mutation also carries @session, write the
		// session before redirecting (this branch is only reached on success — errors 422'd
		// above). The value is server-authoritative (resolver output): a non-null object replaces
		// the session (login), a null one clears it (server-side logout).
		const sessionWrite = nonNullManifest.sessionMutations?.[mutationName]
		if (sessionWrite) {
			const value = valueAtPath(result.data, sessionWrite.sessionPath.split('.'))
			const req = { request, config: config_file, session_keys }
			if (value == null) {
				clear_session(formResponse)
			} else if (sessionWrite.merge) {
				const existing = await get_session(request.headers, session_keys)
				await set_session(req, formResponse, { ...existing, ...(value as App.Session) })
			} else {
				await set_session(req, formResponse, value as App.Session)
			}
		}
		return formResponse
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
			// CSRF protection for the graphql endpoint. A cross-origin page can reach Yoga
			// directly with any CORS-*simple* request (no preflight), carrying the victim's
			// SameSite=Lax cookie — so a `<form>` POST could run any mutation, bypassing the
			// form handler's checks entirely.
			//   - application/x-www-form-urlencoded: never a legit request from us → 415.
			//   - multipart/form-data, text/plain, or no content-type are also CORS-simple
			//     (uploads use multipart), so require a header only our client sets and a
			//     cross-origin simple request cannot.
			//   - application/json is NOT a simple type — it forces a CORS preflight — so it
			//     is already protected and doesn't need the header.
			if (request.method === 'POST') {
				const contentType = request.headers.get('content-type') ?? ''
				if (contentType.includes('application/x-www-form-urlencoded')) {
					return new Response('Unsupported Media Type', { status: 415 })
				}
				const corsSimpleBody =
					contentType === '' ||
					contentType.includes('multipart/form-data') ||
					contentType.includes('text/plain')
				if (corsSimpleBody && !request.headers.get(HOUDINI_REQUEST_HEADER)) {
					return new Response('Forbidden', { status: 403 })
				}
			}
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
