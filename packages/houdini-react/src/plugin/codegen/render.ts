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
	const adapter_path = routerConventions.server_adapter_path(config)

	// make sure the necessary directories exist
	await fs.mkdirp(path.dirname(adapter_path))

	const app_index = `
import { Router } from '$houdini/plugins/houdini-react/runtime'
import React from 'react'

import Shell from '../../../../../src/+index'

export default (props) => (
	<Shell>
		<Router {...props} />
	</Shell>
)
`

	let renderer = `
	import { Cache } from '$houdini/runtime/cache/cache'
import { serverAdapterFactory, _serverHandler } from '$houdini/runtime/router/server'
import { HoudiniClient } from '$houdini/runtime/client'
import { renderToStream } from '$houdini/plugins/houdini-react/runtime/server'
import React from 'react'

import { router_cache } from '../../runtime/routing'
// @ts-expect-error
import client from '../../../../../src/+client'
// @ts-expect-error
import App from "./App"
import router_manifest from '$houdini/plugins/houdini-react/runtime/manifest'

export const on_render =
	({ assetPrefix, pipe, production, documentPremable }) =>
	async ({
		url,
		match,
		session,
		manifest,
		componentCache,
	}) => {
		// instanitate a cache we can use for this request
		const cache = new Cache({
			disabled: false,
			componentCache,
			createComponent: React.createElement
		})

		if (!match) {
			return new Response('not found', { status: 404 })
		}

		const {
			readable,
			injectToStream,
			pipe: pipeTo,
		} = await renderToStream(
			React.createElement(App, {
				initialURL: url,
				cache: cache,
				session: session,
				assetPrefix: assetPrefix,
				manifest: manifest,

				...router_cache()
			}),
			{
				webStream production,
				userAgent: 'Vite',
			}
		)

		// add the initial scripts to the page
		injectToStream(\`
		<script>
			window.__houdini__initial__cache__ = \${cache.serialize()};
			window.__houdini__initial__session__ = \${JSON.stringify(session)};
		</script>

		\${documentPremable ?? ''}

		<!--
			add a virtual module that hydrates the client and sets up the initial pending cache.
			the dynamic extension is to support dev which sees the raw jsx, and production which sees the bundled asset
		-->
		<script type="module" src="\${assetPrefix}/pages/\${match.id}.\${production ? 'js' : 'jsx'}" async=""></script>
	\`)

		if (pipeTo && pipe) {
			pipeTo(pipe)
			return true
		} else {
			return new Response(readable)
		}
	}

export function createServerAdapter(options) {
	return serverAdapterFactory({
		client,
		production: true,
		manifest: router_manifest,
		on_render: on_render(options),
		...options,
	})
}
`

	// and a file that adapters can import to get the local configuration
	let adapter_config = `
		import { createServerAdapter as createAdapter } from './server'

		// add local imports for every component field
		${componentFields
			.map((field) => {
				return `import ${field.fragment} from ${JSON.stringify(
					path.relative(
						path.dirname(adapter_path),
						routerConventions.componentField_unit_path(config, field.fragment)
					)
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

	await Promise.all([
		fs.writeFile(routerConventions.adapter_config_path(config), adapter_config),
		fs.writeFile(adapter_path, renderer),
		fs.writeFile(routerConventions.app_component_path(config), app_index),
	])
}
