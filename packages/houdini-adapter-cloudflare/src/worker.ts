import type { ExportedHandler } from '@cloudflare/workers-types'
import { createServerAdapter } from 'houdini/adapter'

// create the production server adapter
const server_adapter = createServerAdapter({
	production: true,
	assetPrefix: '/assets',
})

const handlers: ExportedHandler = {
	async fetch(req, env: any, ctx) {
		// if we aren't loading an asset, push the request through our router
		const url = new URL(req.url).pathname

		// we are handling an asset
		if (url.startsWith('/assets/') || url === '/favicon.ico') {
			console.log('requesting', req.url)
			return await env.ASSETS.fetch(req)
		}

		// otherwise we just need to render the application like normal
		return await server_adapter(req, env, ctx)
	},
}

export default handlers
