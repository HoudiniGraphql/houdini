import { type Config, fs, path, routerConventions } from 'houdini'

export async function generate_renders(config: Config) {
	// make sure the necessary directories exist
	await fs.mkdirp(path.dirname(routerConventions.render_client_path(config)))

	// everything is in fixed locations so just generate what we need where we need it
	const app_index = `
import React from 'react'
import Shell from '../../../../../src/+index'
import { Router } from '$houdini'

export default (props) => <Shell><Router {...props} /></Shell>
`

	const render_server = `
import React from 'react'
import { renderToStream } from 'react-streaming/server'

import App from './App'
import { router_cache } from '$houdini'

export function render_to_stream({url, cache, loaded_queries, loaded_artifacts, session, ...config}) {
	return renderToStream(
		React.createElement(App, {
			intialURL: url,
			cache,
			...router_cache(),
			loaded_queries,
			session,
			loaded_artifacts,
		}), config
	)
}
`

	await Promise.all([
		fs.writeFile(routerConventions.render_server_path(config), render_server),
		fs.writeFile(routerConventions.render_app_path(config), app_index),
	])
}
