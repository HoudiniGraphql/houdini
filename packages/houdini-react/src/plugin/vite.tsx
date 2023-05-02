import { PluginHooks } from 'houdini'

import { ProjectManifest } from './codegen/manifest'
import { render_server_path } from './conventions'

const vite_hooks = (get_manifest: () => ProjectManifest) =>
	({
		// when running the dev server, we want to use the same streaming
		// render that we will use in production. This means that we need to
		// capture the request before vite's dev server processes it.
		configureServer(server) {
			server.middlewares.use(async (request, response, next) => {
				// we only care about requests for pages in the manifest.
				// TODO: whole manifest
				if (request.url !== '/' && !request.url?.startsWith('/user')) {
					return next()
				}

				// render the response
				const { render_server } = await server.ssrLoadModule(
					render_server_path(server.houdiniConfig) + '?t=' + new Date().getTime()
				)
				render_server(request, response)
			})
		},
	} as PluginHooks['vite'])

export default vite_hooks
