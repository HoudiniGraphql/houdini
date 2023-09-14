// This function defines the primary entrypoint for requests
import type { Config } from 'houdini'

import { plugin_config as get_plugin_config } from '../../plugin/config'
import { set_session } from './session'

export function configure_server({ server, config }: { server: Server; config: Config }) {
	server.use(server_handler({ config }))
}

function server_handler({ config }: { config: Config }): ServerMiddleware {
	// load the plugin config
	const plugin_config = get_plugin_config(config)

	return (req, res, next) => {
		// only consider requests with valid urls
		if (!req.url) {
			next()
			return
		}

		// if the project is configured to authorize users by redirect then
		// we might need to set the session value
		if (
			plugin_config.auth &&
			'redirect' in plugin_config.auth &&
			req.url.startsWith(plugin_config.auth.redirect)
		) {
			return redirect_auth(req, res, next)
		}

		// if we got this far, its not an auth request
		next()
	}
}

const redirect_auth: ServerMiddleware = (req, res, next) => {
	// the session and configuration are passed as query parameters in
	// the url
	const { searchParams } = new URL(req.url!, `http://${req.headers.get('host')}`)
	const { redirectTo, ...session } = Object.fromEntries(searchParams.entries())

	// encode the session information as a cookie in the response
	set_session(res, session)

	// if there is a url to redirect to, do it
	if (redirectTo) {
		return res.redirect(redirectTo)
	}

	// if we got this far we need to move onto the next middleware
	next()
}

export type Server = {
	use(fn: ServerMiddleware): void
}

export type ServerMiddleware = (req: IncomingRequest, res: ServerResponse, next: () => void) => void

export type IncomingRequest = {
	url?: string
	headers: Headers
}

export type ServerResponse = {
	redirect(url: string, status?: number): void
	set_header(name: string, value: string): void
}
