// This function defines the primary entrypoint for requests
import type { Config } from 'houdini'

import { plugin_config as get_plugin_config } from '../plugin/config'

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
	const { searchParams } = new URL(req.url!, `http://${req.headers.host}`)
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

type IncomingRequest = {
	url?: string
	headers: Record<string, string>
}

type ServerResponse = {
	redirect(url: string, status?: number): void
	set_header(name: string, value: string): void
}

const session_cookie_name = '__houdini__'

function set_session(res: ServerResponse, value: Record<string, string>) {
	const today = new Date()
	const expires = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) // Add 7 days in milliseconds

	// serialize the value
	const serialized = JSON.stringify(value)

	// set the cookie with a header
	res.set_header(
		'Set-Cookie',
		`${session_cookie_name}=${serialized}; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=${expires.toUTCString()} `
	)
}
