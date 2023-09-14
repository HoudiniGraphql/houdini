import { getAssetFromKV } from '@cloudflare/kv-asset-handler'
import { ExportedHandler } from '@cloudflare/workers-types'
import { parse } from 'cookie'
import type { QueryArtifact } from 'houdini'
import { Router } from 'itty-router'
import { renderToStream } from 'react-streaming/server'

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
// @ts-expect-error
import { getCurrentConfig as current_config } from '../$houdini/runtime/lib/config'

const app = Router()

const config_file = current_config()
const framework_config = config_file.plugins?.['houdini-react'] ?? {}

const jwt_secret = 'secret'

app.all('/', async (request, next) => {
	// pull out the desired url
	const url = new URL(request.url).pathname

	// load the session cookie
	const cookie = parse(request.headers.get('Cookie') || '')['houdini-session']
	const session = cookie ? JSON.parse(cookie) : null

	// in order to stream values to the client we need to track what we load
	const loaded_queries: Record<string, { data: any; variables: any }> = {}
	const loaded_artifacts: Record<string, QueryArtifact> = {}

	// find the matching url
	const [match] = find_match(manifest, url, true)
	if (!match) {
		return next()
	}

	// instanitate a cache we can use
	const cache = new Cache({ disabled: false })

	const { readable, injectToStream } = await renderToStream(
		<App
			loaded_queries={loaded_queries}
			loaded_artifacts={loaded_artifacts}
			initialURL={url}
			cache={cache}
			session={session}
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
})

const handlers: ExportedHandler = {
	async fetch(req, env: any, ctx) {
		// if we aren't loading an asset, push the request through our router
		const url = new URL(req.url).pathname
		if (!url.startsWith('/assets/')) {
			return app.handle(req)
		}

		// we are handling an asset
		return await env.ASSETS.fetch(req)
	},
}

export default handlers
