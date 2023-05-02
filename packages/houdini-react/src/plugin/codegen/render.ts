import { Config, fs, path } from 'houdini'

import { render_client_path, render_server_path, render_app_path } from '../conventions'

export async function generate_renders(config: Config) {
	// make sure the necessary directories exist
	await fs.mkdirp(path.dirname(render_client_path(config)))

	// everything is in fixed locations so just generate what we need where we need it
	const app_index = `
import React from 'react'
import Shell from '../../../../../src/+index'
import { Router, router_cache } from '$houdini'
import { Cache } from '$houdini/runtime/cache/cache'

export default ({ url }) => <Shell><Router intialURL={url} {...router_cache()}/></Shell>
`

	const render_client = `
import { hydrateRoot } from 'react-dom/client';
import App from './App';

hydrateRoot(document, <App />);
`

	const render_server = `
import React from 'react'
import ReactDOMServer from 'react-dom/server'
import App from './App'

export function render_server(request, response) {
    const { pipe } = ReactDOMServer.renderToPipeableStream(<App url={request.url} />, {
        bootstrapScripts: ['/main.js'],
        onShellReady() {
            response.setHeader('content-type', 'text/html')
            pipe(response)
        },
    })
}
`

	await Promise.all([
		fs.writeFile(render_client_path(config), render_client),
		fs.writeFile(render_server_path(config), render_server),
		fs.writeFile(render_app_path(config), app_index),
	])
}
