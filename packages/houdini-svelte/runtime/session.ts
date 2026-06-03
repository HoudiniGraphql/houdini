import type { LoadEvent, RequestEvent } from '@sveltejs/kit'

import { isBrowser } from './adapter.js'

const sessionKeyName = '__houdini__session__'

const sessionSentinel = {}
// @ts-expect-error
let session: App.Session | {} = sessionSentinel

export function extractSession(val: {
	[sessionKeyName]: // @ts-ignore
	App.Session
}) {
	return val[sessionKeyName]
}

export function buildSessionObject(event: RequestEvent) {
	return {
		[sessionKeyName]: extractSession(event.locals as any),
	}
}

export function setClientSession(
	// @ts-expect-error
	val: App.Session
) {
	if (!isBrowser) {
		return
	}

	session = val
}

// @ts-expect-error
export function getClientSession(): App.Session {
	return session
}

export function setSession(
	event: RequestEvent,
	session: // @ts-ignore
	App.Session
) {
	;(event.locals as any)[sessionKeyName] = session
}

export async function getSession(event?: RequestEvent | LoadEvent): Promise<
	| {}
	// @ts-expect-error
	| App.Session
> {
	if (event) {
		// get the session either from the server side event or the client side event
		if ('locals' in event) {
			// this is a server side event (RequestEvent) -> extract the session from locals
			return extractSession(event.locals as any) || sessionSentinel
		}
		// the session data could also already be present in the data field
		else if ('data' in event && event.data && sessionKeyName in event.data) {
			// @ts-expect-error
			return extractSession(event.data) || sessionSentinel
		} else {
			// this is a client side event -> await the parent data which include the session
			return extractSession((await event.parent()) as any) || sessionSentinel
		}
	}

	return session
}
