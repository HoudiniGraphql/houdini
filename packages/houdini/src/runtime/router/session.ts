import type { ConfigFile } from '../lib'
import { parse } from './cookies'
import { decode, encode, verify } from './jwt'

type ServerHandlerArgs = {
	url: string
	config: ConfigFile
	session_keys: string[]
	headers: Headers
}

// the actual server implementation changes from runtime to runtime
// so we want a single function that can be called to get the server
export async function handle_request(args: ServerHandlerArgs): Promise<Response | undefined> {
	const plugin_config = args.config.router ?? {}
	// if the project is configured to authorize users by redirect then
	// we might need to set the session value
	if (
		plugin_config.auth &&
		'redirect' in plugin_config.auth &&
		args.url.startsWith(plugin_config.auth.redirect)
	) {
		return await redirect_auth(args)
	}
}

async function redirect_auth(args: ServerHandlerArgs): Promise<Response> {
	// the session and configuration are passed as query parameters in
	// the url
	const { searchParams, host } = new URL(args.url!, `http://${args.headers.get('host')}`)
	const { redirectTo, ...session } = Object.fromEntries(searchParams.entries())

	// encode the session information as a cookie in the response and redirect the user
	const response = new Response('ok', {
		status: 302,
		headers: {
			Location: redirectTo ?? '/',
		},
	})
	await set_session(args, response, session)

	return response
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

const session_cookie_name = '__houdini__'

async function set_session(req: ServerHandlerArgs, response: Response, value: App.Session) {
	const today = new Date()
	const expires = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) // Add 7 days in milliseconds

	// serialize the value
	const serialized = await encode(value, req.session_keys[0])

	// set the cookie with a header
	response.headers.set(
		'Set-Cookie',
		`${session_cookie_name}=${serialized}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires.toUTCString()} `
	)
}

export async function get_session(req: Headers, secrets: string[]): Promise<App.Session> {
	// get the cookie header
	const cookies = req.get('cookie')
	if (!cookies) {
		return {}
	}
	const cookie = parse(cookies)[session_cookie_name]
	if (!cookie) {
		return {}
	}

	// decode it with any of the available secrets
	for (const secret of secrets) {
		// check if its valid
		if (!(await verify(cookie, secret))) {
			continue
		}

		// parse the cookie header
		const parsed = decode(cookie)
		if (!parsed) {
			return {}
		}

		return parsed.payload as App.Session
	}

	// if we got this far then the cookie value didn't match any of the available secrets
	return {}
}
