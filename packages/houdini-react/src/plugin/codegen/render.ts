import { type Config, fs, path } from 'houdini'

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

	const render_server = `
import React from 'react'
import ReactDOMServer from 'react-dom/server'

import App from './App'
import { router_cache } from '$houdini'

export async function render_server({url, cache, loaded_queries, loaded_artifacts, ...config}) {
    const { pipe } = ReactDOMServer.renderToPipeableStream(
			<App
				intialURL={url}
				cache={cache}
				{...router_cache()}
				loaded_queries={loaded_queries}
				loaded_artifacts={loaded_artifacts}
			/>
		,
		{
			...config,
			onShellReady() {
				config.onShellReady?.(pipe)
			},
		}
	)
}
`

	await Promise.all([
		fs.writeFile(render_server_path(config), render_server),
		fs.writeFile(render_app_path(config), app_index),
	])
}
