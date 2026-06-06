import { Cache } from 'houdini/runtime/cache'
import { serverAdapterFactory, _serverHandler } from 'houdini/router/server'
import { HoudiniClient } from 'houdini/runtime/client'
import { renderToStream } from 'houdini-react/server'
import React from 'react'

import { router_cache } from '../../runtime/routing'
// @ts-expect-error
import client from '../../../../../src/+client'
// @ts-expect-error
import App from "./App"
import router_manifest from '$houdini/plugins/houdini-react/runtime/manifest'

import config from '../../../../../houdini.config.js'

export const on_render =
	({ assetPrefix, pipe, production, documentPremable }) =>
	async ({
		url,
		match,
		session,
		manifest,
		componentCache,
	}) => {
		const cache = new Cache({
			disabled: false,
			...config,
			componentCache,
			createComponent: React.createElement
		})

		if (!match) {
			return new Response('not found', { status: 404 })
		}

		// Wire the per-request cache into the client so that all observe() calls
		// during this render write to (and read from) the same cache we serialize.
		client.setCache(cache)

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
			{ webStream: production, userAgent: 'Vite' }
		)

		injectToStream(`
		<script>
			window.__houdini__initial__cache__ = ${cache.serialize()};
			window.__houdini__initial__session__ = ${JSON.stringify(session)};
		</script>

		${documentPremable ?? ''}

		<script type="module" src="${assetPrefix}/pages/${match.id}.${production ? 'js' : 'jsx'}" async=""></script>
	`)

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
		config_file: config,
		...options,
	})
}
