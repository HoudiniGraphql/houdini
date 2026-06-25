import { createServerAdapter } from '@whatwg-node/server'
import type { ServerAdapterRequestHandler } from '@whatwg-node/server'
import type { GraphQLSchema } from 'graphql'
import {
	YogaServer,
	type YogaInitialContext,
	type YogaServerOptions as YogaConfig,
} from 'graphql-yoga'

import type { ConfigFile, ServerConfigFile } from '../lib/config.js'
import type { HoudiniClient } from '../runtime/client.js'
import { getAuthUrl, resolveApiEndpoint, setAuthUrl } from '../runtime/config.js'
import { interpolateRedirect, valueAtPath } from '../runtime/endpoint.js'
import { coerceFormData } from '../runtime/formData.js'
import { buildGraphQLBody } from '../runtime/multipart.js'
import { marshalInputs } from '../runtime/scalars.js'
import { CSRF_FIELD, signFormToken, verifyFormToken, signSessionToken } from './auth-token.js'
import { serialize as encodeCookie } from './cookies.js'
import { find_match, find_prefix_match } from './match.js'
import {
	applySessionToken,
	clear_session,
	get_session,
	handle_request,
	isAllowedOrigin,
	session_cookie_name,
	set_session,
	sign_session,
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

// the client tells the @session proxy which operation it's relaying via this header, so the proxy
// never has to parse a (possibly multipart) body to find the session path. Must stay in sync with
// the header set in fetch.ts. It only selects which sessionMutations entry to read — the session
// value still comes solely from the upstream result, so the header isn't trust-sensitive.
const HOUDINI_OPERATION_HEADER = 'x-houdini-operation'

// readBodyWithLimit drains the request body while counting bytes, aborting (→ null) once `maxBytes`
// is exceeded — so a chunked/Content-Length-less body can't be buffered without bound. On success
// it returns a fresh Request wrapping the buffered bytes (same headers, so the content-type +
// multipart boundary survive) for formData() to parse.
async function readBodyWithLimit(request: Request, maxBytes: number): Promise<Request | null> {
	if (!request.body) {
		return request
	}
	const reader = request.body.getReader()
	const chunks: Uint8Array[] = []
	let total = 0
	while (true) {
		const { done, value } = await reader.read()
		if (done) {
			break
		}
		if (value) {
			total += value.byteLength
			if (total > maxBytes) {
				await reader.cancel()
				return null
			}
			chunks.push(value)
		}
	}
	const body = new Uint8Array(total)
	let offset = 0
	for (const chunk of chunks) {
		body.set(chunk, offset)
		offset += chunk.byteLength
	}
	return new Request(request.url, {
		method: request.method,
		headers: request.headers,
		body,
	})
}

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
					const token = await mintSessionToken({
						data: result.data,
						errors: result.errors,
						operationName: operationNameOf(args),
						requestHeaders: args.contextValue.request.headers,
						manifest,
						sessionKeys,
					})
					if (!token) {
						return
					}
					setResult({
						...result,
						extensions: { ...result.extensions, houdiniSession: token },
					})
				},
			}
		},
	}
}

// mintSessionToken is the shared heart of the @session server path: given a mutation result it
// signs the resolver's session subtree into a server-authoritative token, or returns null when the
// result shouldn't touch the session. Used by BOTH sessionMintPlugin (local Yoga, token relayed by
// the client) and the remote-API proxy (which applies the token in-process). Keeping it in one
// place means every @session sink mints identically — same sid-binding, same merge/clear/replace,
// same "errors never write" rule — so the proxy adds no new session-write logic to audit.
async function mintSessionToken({
	data,
	errors,
	operationName,
	requestHeaders,
	manifest,
	sessionKeys,
}: {
	data: any
	errors: any
	operationName: string | null
	requestHeaders: Headers
	manifest: RouterManifest<any> | null
	sessionKeys: string[]
}): Promise<string | null> {
	// a failed @session mutation must never touch the session — auth failure is signalled by a
	// GraphQL error, and only a *successful* execution mints a token.
	if (errors?.length) {
		return null
	}
	const session = operationName ? manifest?.sessionMutations?.[operationName] : undefined
	if (!session) {
		return null
	}
	// on success: a non-null value writes the session (merge or replace per the directive); a null
	// one clears it (logout — e.g. a server-side logout mutation whose session field comes back
	// null). signSessionToken encodes which action, so the consumer just applies it. Bind the token
	// to the session the mutation ran under (sid) so a leaked token can't be replayed elsewhere.
	const value = valueAtPath(data, session.sessionPath.split('.'))
	const priorSession = await get_session(requestHeaders, sessionKeys)
	return await signSessionToken(
		(value ?? null) as App.Session | null,
		sessionKeys,
		session.merge,
		priorSession
	)
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
	server_config,
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
		// the session endpoint, injected so the client relay/useSession can reach it without the
		// (server-only) auth config living in the client bundle. The GraphQL endpoint and the proxy
		// path are NOT injected — the client derives both from the public config it already bundles.
		authUrl?: string
	}) => Response | Promise<Response | undefined> | undefined
	config_file: ConfigFile
	// the server-only config (src/server/+config) — sessionKeys live here, never in config_file
	server_config?: ServerConfigFile
} & Omit<YogaServerOptions, 'schema'>) {
	const session_keys = localApiSessionKeys(server_config)

	// the session endpoint is server-only config (it can be customized in src/server/+config), so it
	// is still published for the client at render via getAuthUrl(). The GraphQL endpoint is NOT —
	// it's public config the client reads straight from the bundle (resolveApiEndpoint).
	setAuthUrl(server_config?.auth?.url)

	// the @session proxy is mounted ONLY when there's no local schema. With a local schema the
	// mutation runs through the local Yoga and the mint plugin signs the token inline; without one
	// the GraphQL request goes to the remote `url` that can't mint, so the client routes @session
	// mutations through this same-origin path and the server writes the cookie itself.
	const sessionProxyPath = schema ? undefined : getAuthUrl() + '/proxy'

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
						// sign the session so the local handler's get_session (a signed-JWT verify)
						// accepts it — a raw JSON cookie is rejected and would run session-less.
						Cookie: encodeCookie(
							session_cookie_name,
							await sign_session(session ?? {}, session_keys[0]),
							{ httpOnly: true }
						),
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
		// clickjacking default: the @endpoint form CSRF token doesn't stop a framed, same-origin page
		// from being click-jacked into submitting, so block cross-origin framing by default. A page
		// can opt out (e.g. for an embed) by setting these in its own headers() export.
		apply_antiframing_defaults(headers)

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
			// the session endpoint, injected so the client relay/useSession can reach it (it's
			// server-only config). The GraphQL endpoint + proxy path are derived client-side from
			// the public config, so they aren't injected here.
			authUrl: getAuthUrl(),
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
		if (!isAllowedOrigin(request, server_config)) {
			return new Response('Forbidden', { status: 403 })
		}

		// DoS guard: reject an over-large body. The Content-Length header is a fast path, but it can
		// be absent (chunked transfer) or lie, so we ALSO count bytes while reading the stream and
		// abort once the cap is exceeded — never buffering an unbounded body into formData().
		const maxBodyBytes = server_config?.formMaxBodyBytes ?? 10 * 1024 * 1024
		const contentLength = Number(request.headers.get('content-length'))
		if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
			return new Response('Payload Too Large', { status: 413 })
		}
		const limited = await readBodyWithLimit(request, maxBodyBytes)
		if (limited === null) {
			return new Response('Payload Too Large', { status: 413 })
		}

		const formData = await limited.formData()

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
					// sign the session so the in-process handler's get_session (a signed-JWT verify)
					// accepts it — a raw JSON value would fail verification and run session-less
					Cookie: encodeCookie(
						session_cookie_name,
						await sign_session(session ?? {}, session_keys[0]),
						{ httpOnly: true }
					),
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

	// handleSessionProxy is the server half of @session for a REMOTE api (no local schema). The
	// client routes a @session mutation here instead of straight to `apiEndpoint`; the proxy
	// forwards it to that same upstream, then writes the session cookie from the result so the value
	// stays server-authoritative (the client can't forge it). It deliberately adds NO new session
	// machinery: it reuses isAllowedOrigin (CSRF), readBodyWithLimit (DoS), mintSessionToken +
	// applySessionToken (the exact sign → verify → sid-bind → single-use → write chain the relay
	// uses). Returns undefined when the request isn't the proxy so the caller falls through.
	const handleSessionProxy = async (request: Request): Promise<Response | undefined> => {
		// only mounted when there's no local schema; the path is fixed and same-origin
		if (!sessionProxyPath || new URL(request.url).pathname !== sessionProxyPath) {
			return undefined
		}
		// it writes the session cookie, so it's a state-changing sink: POST + same-origin only
		if (request.method !== 'POST') {
			return new Response('Method Not Allowed', { status: 405 })
		}
		if (!isAllowedOrigin(request, server_config)) {
			return new Response('Forbidden', { status: 403 })
		}

		// DoS guard: bound the proxied body exactly like the form handler before buffering it
		const maxBodyBytes = server_config?.formMaxBodyBytes ?? 10 * 1024 * 1024
		const limited = await readBodyWithLimit(request, maxBodyBytes)
		if (limited === null) {
			return new Response('Payload Too Large', { status: 413 })
		}
		// buffer as bytes (not text) so a multipart @session upload survives forwarding intact
		const bodyBytes = new Uint8Array(await limited.arrayBuffer())

		// forward to the FIXED upstream (the configured `url`) — NEVER a value derived from the
		// request, so this can't be turned into an open proxy / SSRF. Strip cookie + host so
		// Houdini's session cookie (auto-attached to this same-origin request) never leaks to the
		// third-party api; the client could already call the upstream directly, so forwarding its
		// other headers (e.g. Authorization) grants it no capability it didn't already have.
		const forwardHeaders = new Headers(request.headers)
		forwardHeaders.delete('cookie')
		forwardHeaders.delete('host')
		forwardHeaders.delete('content-length') // refers to the original stream; fetch recomputes it
		forwardHeaders.delete(HOUDINI_OPERATION_HEADER) // our internal routing hint, not for the api
		let upstreamResponse: Response
		try {
			upstreamResponse = await fetch(resolveApiEndpoint(config_file), {
				method: 'POST',
				headers: forwardHeaders,
				body: bodyBytes,
			})
		} catch {
			return new Response('Bad Gateway', { status: 502 })
		}

		// relay a non-JSON upstream response verbatim — there's nothing to mint from it
		const upstreamText = await upstreamResponse.text()
		let payload: any
		try {
			payload = JSON.parse(upstreamText)
		} catch {
			return new Response(upstreamText, {
				status: upstreamResponse.status,
				headers: {
					'content-type': upstreamResponse.headers.get('content-type') ?? 'text/plain',
				},
			})
		}

		// the operation name to look up in sessionMutations is sent as a header by the client, so we
		// never parse the (possibly multipart) body to find it — JSON and multipart @session
		// mutations both establish the session identically.
		const operationName = request.headers.get(HOUDINI_OPERATION_HEADER)

		// the placeholder response is just a Set-Cookie carrier for applySessionToken; the body is
		// rebuilt below so the success flag rides along only when the cookie was actually written.
		const carrier = new Response(null, { status: upstreamResponse.status })
		let body = payload
		const token = await mintSessionToken({
			data: payload?.data,
			errors: payload?.errors,
			operationName,
			requestHeaders: request.headers,
			manifest,
			sessionKeys: session_keys,
		})
		if (
			token &&
			(await applySessionToken(
				{ request, config: config_file, server_config, session_keys },
				carrier,
				token
			))
		) {
			// signal the client that the cookie was set so useSession() mirrors without a refresh and
			// without relaying (the relay POST path is only for the local-Yoga case). A boolean flag,
			// never the token — the value itself is already in the result data the client can see.
			body = {
				...payload,
				extensions: { ...payload?.extensions, houdiniSessionApplied: true },
			}
		}
		carrier.headers.set('content-type', 'application/json')
		return new Response(JSON.stringify(body), {
			status: upstreamResponse.status,
			headers: carrier.headers,
		})
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

		// maybe it's a @session mutation proxied through us for a remote api. Checked BEFORE
		// handle_request because the proxy path lives under the auth url (handle_request would
		// otherwise claim it via its startsWith match).
		const proxyResponse = await handleSessionProxy(request)
		if (proxyResponse) {
			return proxyResponse
		}

		// maybe its a session-related request
		const authResponse = await handle_request({
			request,
			config: config_file,
			server_config,
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

// apply_antiframing_defaults adds anti-clickjacking response headers unless the page already set
// them via its headers() export. `frame-ancestors` is the modern control; `X-Frame-Options` is the
// legacy fallback. Both default to same-origin: cross-origin framing is blocked, same-origin embeds
// still work. A page that needs to be framed elsewhere overrides them in its own headers().
export function apply_antiframing_defaults(headers: Record<string, string>) {
	const has = (name: string) => Object.keys(headers).some((key) => key.toLowerCase() === name)
	if (!has('content-security-policy')) {
		headers['Content-Security-Policy'] = "frame-ancestors 'self'"
	}
	if (!has('x-frame-options')) {
		headers['X-Frame-Options'] = 'SAMEORIGIN'
	}
}

export type ServerAdapterFactory = typeof serverAdapterFactory

function localApiSessionKeys(serverConfig?: ServerConfigFile) {
	return serverConfig?.auth?.sessionKeys ?? []
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
