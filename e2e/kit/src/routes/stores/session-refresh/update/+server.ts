import { setSession } from '$houdini'
import { json, type RequestHandler } from '@sveltejs/kit'

const updatedToken = 'updated-Houdini-Token-0000'

export const POST: RequestHandler = (event) => {
	event.cookies.set('houdini-session-token', updatedToken, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
	})
	setSession(event, { user: { token: updatedToken } })

	return json({ token: updatedToken })
}
