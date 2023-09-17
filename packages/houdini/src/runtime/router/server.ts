// This function defines the primary entrypoint for requests
import type { ConfigFile } from '../lib'
import { decode, encode, verify } from './jwt'

type ServerHandlerArgs = {
	url: string
	config: ConfigFile
	session_keys: string[]
	set_header: (key: string, value: string | number | string[]) => void
	get_header: (key: string) => string | number | string[] | undefined
	redirect: (code: number, url: string) => void
	next: () => void
}

// the actual server implementation changes from runtime to runtime
// so we want a single function that can be called to get the server
export async function handle_request(args: ServerHandlerArgs) {
	// @ts-expect-error: typescript doesn't know about this property
	const plugin_config = args.config.plugins?.['houdini-react']

	// if the project is configured to authorize users by redirect then
	// we might need to set the session value
	if (
		plugin_config.auth &&
		'redirect' in plugin_config.auth &&
		args.url.startsWith(plugin_config.auth.redirect)
	) {
		return await redirect_auth(args)
	}

	// it's not something we care about
	args.next()
}

async function redirect_auth(args: ServerHandlerArgs) {
	// the session and configuration are passed as query parameters in
	// the url
	const { searchParams } = new URL(args.url!, `http://${args.get_header('host')}`)
	const { redirectTo, ...session } = Object.fromEntries(searchParams.entries())

	// encode the session information as a cookie in the response
	await set_session(args, session)

	// if there is a url to redirect to, do it
	if (redirectTo) {
		return args.redirect(302, redirectTo)
	}

	// move onto the next thing
	console.log('calling next in redirect_auth')
	args.next()
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

async function set_session(req: ServerHandlerArgs, value: App.Session) {
	const today = new Date()
	const expires = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) // Add 7 days in milliseconds

	// serialize the value
	const serialized = await encode(value, req.session_keys[0])

	// set the cookie with a header
	req.set_header(
		'Set-Cookie',
		`${session_cookie_name}=${serialized}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires.toUTCString()} `
	)
}

export async function get_session(req: Headers, secrets: string[]): Promise<App.Session> {
	// get the cookie header
	const cookie = req.get('cookie')
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

		return parsed.payload
	}

	// if we got this far then the cookie value didn't match any of the available secrets
	return {}
}
