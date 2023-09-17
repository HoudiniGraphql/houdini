import type { ExportedHandler } from '@cloudflare/workers-types'
import { renderToStream } from 'react-streaming/server'

// The following imports local assets from the generated runtime
// This is not the desired API. just the easiest way to get this working
// and validate the rendering strategy
//
// @ts-expect-error
import { router_cache } from '../$houdini/plugins/houdini-react/runtime'
// @ts-expect-error
import manifest from '../$houdini/plugins/houdini-react/runtime/manifest'
// @ts-expect-error
import { find_match } from '../$houdini/plugins/houdini-react/runtime/routing/lib/match'
// @ts-expect-error
import App from '../$houdini/plugins/houdini-react/units/render/App'
// @ts-expect-error
import { Cache } from '../$houdini/runtime/cache/cache.js'
// @ts-expect-error
import { getCurrentConfig } from '../$houdini/runtime/lib/config'
import {
	handle_request,
	get_session, // @ts-expect-error
} from '../$houdini/runtime/router/server'

// load the plugin config
const configFile = getCurrentConfig()
// @ts-ignore
const plugin_config = configFile.plugins?.['houdini-react'] ?? {}

const session_keys = plugin_config.auth?.sessionKeys ?? []

const handlers: ExportedHandler = {
	async fetch(req, env: any, ctx) {
		// if we aren't loading an asset, push the request through our router
		const url = new URL(req.url).pathname

		// we are handling an asset
		if (url.startsWith('/assets/') || url === '/favicon.ico') {
			return await env.ASSETS.fetch(req)
		}

		// we might need to pass the request onto houdini's internal router
		const server_response = await internal_router(req)
		if (server_response) {
			return server_response
		}

		// otherwise we just need to render the application
		return await render_app(req)
	},
}

async function internal_router(request: Parameters<Required<ExportedHandler>['fetch']>[0]) {
	// build up the response that wraps houdini's internal logic
	let response = new Response()
	let use_response = false

	await handle_request({
		config: configFile,
		session_keys,
		url: new URL(request.url).pathname,
		redirect: (status: number, location: string) => {
			const old_headers = response.headers

			// the response is now a redirect
			response = Response.redirect(location, status)

			// preserve the old headers
			for (const [key, value] of Object.entries(old_headers)) {
				response.headers.set(key, value)
			}
		},
		set_header(key: string, value: string) {
			response.headers.set(key, value.toString())
		},
		get_header: (key: string) => request.headers.get(key) ?? undefined,
		next() {
			use_response = false
		},
	})

	// if no one called next, we need to return the response
	if (use_response) {
		return response
	}
}

async function render_app(request: Parameters<Required<ExportedHandler>['fetch']>[0]) {
	// pull out the desired url
	const url = new URL(request.url).pathname

	// load the session cookie
	const session = await get_session(request.headers, session_keys)

	// find the matching url
	const [match] = find_match(manifest, url, true)
	if (!match) {
		throw new Error('no match')
	}

	// instanitate a cache we can use
	const cache = new Cache({ disabled: false })

	const { readable, injectToStream } = await renderToStream(
		<App
			loaded_queries={{}}
			loaded_artifacts={{}}
			initialURL={url}
			cache={cache}
			session={session}
			assetPrefix={'/assets'}
			{...router_cache()}
		/>,
		{
			userAgent: 'Vite',
		}
	)

	// add the initial scripts to the page
	injectToStream(`
			<script>
				window.__houdini__initial__cache__ = ${cache.serialize()};
				window.__houdini__initial__session__ = ${JSON.stringify(session)};
			</script>

			<!-- add a virtual module that hydrates the client and sets up the initial pending cache -->
			<script type="module" src="/assets/pages/${match.id}.js" async=""></script>
		`)

	// and deliver our Response while that’s running.
	return new Response(readable)
}

export default handlers
