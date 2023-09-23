// @ts-ignore
import { ExportedHandler } from '@cloudflare/workers-types'

import {
	createServerAdapter,
	type ServerAdapter, // @ts-ignore
} from '../$houdini/plugins/houdini-react/units/render/server'

/**
  the exact fomatting on the next line matters and it has to be the boundary between imports
  and the rest of the code. we replace it at build time with the project-specific configuration.
*/

console.log('DYNAMIC_CONTENT')

// create the production server adapter
const server_adapter: ServerAdapter = createServerAdapter({
	// @ts-ignore: schema is defined dynamically
	schema,
	// @ts-ignore: yoga is defined dynamically
	yoga,
	// @ts-ignore: graphqlEndpoint is defined dynamically
	graphqlEndpoint,
	production: true,
})

const handlers: ExportedHandler = {
	async fetch(req, env: any, ctx) {
		// if we aren't loading an asset, push the request through our router
		const url = new URL(req.url).pathname

		// we are handling an asset
		if (url.startsWith('/assets/') || url === '/favicon.ico') {
			return await env.ASSETS.fetch(req)
		}

		// otherwise we just need to render the application like normal
		return await server_adapter(req, env, ctx)
	},
}

export default handlers
