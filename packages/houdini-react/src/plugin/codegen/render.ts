import { type Config, fs, path, routerConventions } from 'houdini'

export async function generate_renders(config: Config) {
	// make sure the necessary directories exist
	await fs.mkdirp(path.dirname(routerConventions.server_adapter_path(config)))

	const server_adapter = `
import React from 'react'
import { renderToStream } from 'react-streaming/server'
import { Cache } from '$houdini/runtime/cache/cache'
import { serverAdapterFactory } from '$houdini/runtime/router/server'

import { Router, router_cache } from '../../runtime'

import Shell from '../../../../../src/+index'

export default (options) => {
	return serverAdapterFactory({
		...options,
		on_render: async ({url, match, session, pipe }) => {
			// instanitate a cache we can use for this request
			const cache = new Cache({ disabled: false })

			if (!match) {
				return new Response('not found', { status: 404 })
			}

			const { readable, injectToStream, pipe: pipeTo } = await renderToStream(
				React.createElement(Shell, {
					children: React.createElement(Router, {
						initialURL: url,
						cache: cache,
						session: session,
						assetPrefix: options.asset_prefix,
						manifest: options.manifest,
						...router_cache()
					})
				}),
				{
					userAgent: 'Vite',
				}
			)

			// add the initial scripts to the page
			injectToStream(\`
				<script>
					window.__houdini__initial__cache__ = \${cache.serialize()};
					window.__houdini__initial__session__ = \${JSON.stringify(session)};
				</script>

				<!-- add a virtual module that hydrates the client and sets up the initial pending cache -->
				<script type="module" src="\${options.asset_prefix}/pages/\${match.id}.jsx" async=""></script>
			\`)

			if (pipe && pipeTo) {
				// pipe the response to the client
				pipeTo(pipe)
			} else {
				// and deliver our Response while that's running.
				return new Response(readable)
			}
		},
	})
}
	`

	await Promise.all([fs.writeFile(routerConventions.server_adapter_path(config), server_adapter)])
}
