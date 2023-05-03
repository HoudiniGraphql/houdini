import { Config, fs, path } from 'houdini'

import { render_client_path, render_server_path, render_app_path } from '../conventions'

export async function generate_renders(config: Config) {
	// make sure the necessary directories exist
	await fs.mkdirp(path.dirname(render_client_path(config)))

	// everything is in fixed locations so just generate what we need where we need it
	const app_index = `
import React from 'react'
import Shell from '../../../../../src/+index'
import { Router } from '$houdini'

export default (props) => <Shell><Router {...props} /></Shell>
`

	const render_client = `
import { hydrateRoot } from 'react-dom/client';
import App from './App'
import { Cache } from '$houdini/runtime/cache/cache'
import { router_cache } from '$houdini'
import client  from '$houdini/plugins/houdini-react/runtime/client'

// attach things to the global scope to synchronize streaming
window.__houdini__nav_caches__ = router_cache()
window.__houdini__cache__ = new Cache()
window.__houdini__hydration__layer__ = window.__houdini__cache__._internal_unstable.storage.createLayer(true)

console.log({client})
window.__houdini__client__ = client

window.__houdini__cache__.hydrate(
	window.__houdini__initial__cache__,
	window.__houdini__hydration__layer__
)

// hydrate the application for interactivity
hydrateRoot(document, <App cache={window.__houdini__cache__} {...window.__houdini__nav_caches__} />)
`

	const render_server = `
import React from 'react'
import ReactDOMServer from 'react-dom/server'
import { renderToStream } from 'react-streaming/server'

import App from './App'
import { router_cache } from '$houdini'

export async function render_server({url, cache, completed_queries, ...config}) {
    const { pipe } = ReactDOMServer.renderToPipeableStream(<App intialURL={url} cache={cache} {...router_cache()} completed_queries={completed_queries} />, {
        ...config,
        onShellReady() {
			config.onShellReady?.(pipe)
        },
    })
}

export async function render_streaming({ url, cache }) {

}
`

	await Promise.all([
		fs.writeFile(render_client_path(config), render_client),
		fs.writeFile(render_server_path(config), render_server),
		fs.writeFile(render_app_path(config), app_index),
	])
}
