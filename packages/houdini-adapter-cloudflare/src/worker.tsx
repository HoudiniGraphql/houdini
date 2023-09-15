import { ExportedHandler } from '@cloudflare/workers-types'
import { parse } from 'cookie'
import type { QueryArtifact } from 'houdini'
import { renderToStream } from 'react-streaming/server'

// The following imports local assets from the generated runtime
// This is not the desired API. just the easiest way to get this working
// and validate the rendering strategy
//
//
// @ts-expect-error
import { router_cache } from '../$houdini'
// @ts-expect-error
import manifest from '../$houdini/plugins/houdini-react/runtime/manifest'
// @ts-expect-error
import { find_match } from '../$houdini/plugins/houdini-react/runtime/routing/lib/match'
// @ts-expect-error
import App from '../$houdini/plugins/houdini-react/units/render/App'
// @ts-expect-error
import { Cache } from '../$houdini/runtime/cache/cache.js'

const handlers: ExportedHandler = {
	async fetch(req, env: any, ctx) {
		// if we aren't loading an asset, push the request through our router
		const url = new URL(req.url).pathname

		// we are handling an asset
		if (url.startsWith('/assets/') || url === '/favicon.ico') {
			return await env.ASSETS.fetch(req)
		}

		// otherwise we just need to render the application
		return await render_app(req)
	},
}

async function render_app(request: Parameters<Required<ExportedHandler>['fetch']>[0]) {
	// pull out the desired url
	const url = new URL(request.url).pathname

	// load the session cookie
	const cookie = parse(request.headers.get('Cookie') || '')['houdini-session']
	const session = cookie ? JSON.parse(cookie) : null

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
