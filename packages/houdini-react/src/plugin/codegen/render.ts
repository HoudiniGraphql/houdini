import {
	fs,
	path,
	routerConventions,
	localApiEndpoint,
	type Config,
	type ProjectManifest,
} from 'houdini'

import type { ComponentFieldData } from '.'

export async function generate_renders({
	componentFields,
	config,
	manifest,
}: {
	componentFields: ComponentFieldData[]
	config: Config
	manifest: ProjectManifest
}) {
	const server_adapter_path = routerConventions.server_adapter_path(config)

	// make sure the necessary directories exist
	await fs.mkdirp(path.dirname(server_adapter_path))

	const app_index = `
import React from 'react'
import Shell from '../../../../../src/+index'
import { Router } from '$houdini'

export default (props) => <Shell><Router {...props} /></Shell>
`

	// and a file that adapters can import to get the local configuration
	let adapter_config = `
		import createAdapter from './server'

		// add local imports for every component field
		${componentFields
			.map((field) => {
				return `import ${field.fragment} from ${JSON.stringify(
					path.relative(path.dirname(server_adapter_path), field.filepath)
				)}`
			})
			.join('\n')}

		${
			manifest.local_schema
				? `import schema from '../../../../../src/api/+schema'`
				: ' const schema = null'
		}
		${manifest.local_yoga ? `import yoga from '.../../../../../src/api/+yoga'` : ' const yoga = null'}

		export const endpoint = ${JSON.stringify(localApiEndpoint(config.configFile))}

		// we need to export the component cache so the server can render the client
		export const componentCache = {
			${componentFields
				.map((field) => {
					return `${JSON.stringify(`${field.type}.${field.field}`)}: ${field.fragment}`
				})
				.join(',\n')}
		}

		export function createServerAdapter(options) {
			return createAdapter({
				schema,
				yoga,
				componentCache,
				graphqlEndpoint: endpoint,
				...options,
			})
		}
	`

	// we need a file in the local runtime that we can use to drive the server-side responses
	const server_adapter = `
import React from 'react'
import { renderToStream } from 'react-streaming/server'
import { Cache } from '$houdini/runtime/cache/cache'
import { serverAdapterFactory } from '$houdini/runtime/router/server'

import { Router, router_cache } from '../../runtime'
import manifest from '../../runtime/manifest'
import App from './App'

import Shell from '../../../../../src/+index'

export default (options) => {
	return serverAdapterFactory({
		manifest,
		...options,
		on_render: async ({url, match, session, pipe , manifest }) => {
			// instanitate a cache we can use for this request
			const cache = new Cache({ disabled: false })

			if (!match) {
				return new Response('not found', { status: 404 })
			}

			const { readable, injectToStream, pipe: pipeTo } = await renderToStream(
				React.createElement(App, {
					initialURL: url,
					cache: cache,
					session: session,
					assetPrefix: options.assetPrefix,
					manifest: manifest,
					...router_cache()
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

				<!--
					add a virtual module that hydrates the client and sets up the initial pending cache.
					the dynamic extension is to support dev which sees the raw jsx, and production which sees the bundled asset
				-->
				<script type="module" src="\${options.assetPrefix}/pages/\${match.id}.\${options.production ? 'js' : 'jsx'}" async=""></script>
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

	await Promise.all([
		fs.writeFile(routerConventions.server_adapter_path(config), server_adapter),
		fs.writeFile(routerConventions.adapter_config_path(config), adapter_config),
		fs.writeFile(routerConventions.app_component_path(config), app_index),
	])
}
