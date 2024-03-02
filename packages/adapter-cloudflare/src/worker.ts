import type { ExportedHandler } from '@cloudflare/workers-types'
import { createServerAdapter } from 'houdini/adapter'

// create the production server adapter
const server_adapter = createServerAdapter({
	production: true,
	assetPrefix: '/assets',
})

const handlers: ExportedHandler = {
	async fetch(req, env: any, ctx) {
		const accept = req.headers.get('Accept') ?? ''

		// our server is responsible for serving
		// html, json, and json, graphql
		const patterns = ['text/html', 'application/json', 'application/graphql']

		// we are handling an asset
		if (!patterns.some((pattern) => accept.includes(pattern))) {
			return await env.ASSETS.fetch(req)
		}

		// otherwise we just need to render the application like normal
		return await server_adapter(req, env, ctx)
	},
}

export default handlers
