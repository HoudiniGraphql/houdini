import cookieParser from 'cookie-parser'

import type { ServerResponse } from '.'

const session_cookie_name = '__houdini__'

export function set_session(res: ServerResponse, value: App.Session) {
	const today = new Date()
	const expires = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) // Add 7 days in milliseconds

	// serialize the value
	const serialized = JSON.stringify(value)

	// set the cookie with a header
	res.set_header(
		'Set-Cookie',
		`${session_cookie_name}=${serialized}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires.toUTCString()} `
	)
}

export function get_session(req: Headers, secrets: string[]): App.Session {
	// get the cookie header
	const cookie = req.get('cookie')
	if (!cookie) {
		return {}
	}

	// parse the cookie header
	const parsed = cookieParser.signedCookie(cookie, secrets)
	if (!parsed) {
		return {}
	}

	// From cookieParser.signedCookie(str, secret) doc: If the value was not signed, the original value is returned
	if (parsed === cookie) {
		return {}
	}

	// the value is an object with session information
	return JSON.parse(parsed.split('=')[1])
}
