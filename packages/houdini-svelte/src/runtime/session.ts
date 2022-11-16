import { marshalInputs } from '$houdini/runtime/lib/scalars'
import {
	MutationArtifact,
	QueryArtifact,
	QueryResult,
	SubscriptionArtifact,
} from '$houdini/runtime/lib/types'
import { error, LoadEvent, redirect, RequestEvent } from '@sveltejs/kit'
import { GraphQLError } from 'graphql'
import { get } from 'svelte/store'

import { isBrowser } from './adapter'
import { AfterLoadArgs, BeforeLoadArgs, OnErrorArgs } from './types'

const sessionKeyName = '__houdini__session__'

export class RequestContext {
	private loadEvent: LoadEvent
	continue: boolean = true
	returnValue: {} = {}

	constructor(ctx: LoadEvent) {
		this.loadEvent = ctx
	}

	error(status: number, message: string | Error): any {
		throw error(status, typeof message === 'string' ? message : message.message)
	}

	redirect(status: 300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308, location: string): any {
		throw redirect(status, location)
	}

	fetch(input: RequestInfo, init?: RequestInit) {
		// make sure to bind the window object to the fetch in a browser
		const fetch =
			typeof window !== 'undefined' ? this.loadEvent.fetch.bind(window) : this.loadEvent.fetch

		return fetch(input, init)
	}

	graphqlErrors(payload: { errors?: GraphQLError[] }) {
		// if we have a list of errors
		if (payload.errors) {
			return this.error(500, payload.errors.map(({ message }) => message).join('\n'))
		}

		return this.error(500, 'Encountered invalid response: ' + JSON.stringify(payload))
	}

	// This hook fires before executing any queries, it allows custom props to be passed to the component.
	async invokeLoadHook({
		variant,
		hookFn,
		input,
		data,
		error,
	}: {
		variant: 'before' | 'after' | 'error'
		hookFn: KitBeforeLoad | KitAfterLoad | KitOnError
		input: Record<string, any>
		data: Record<string, any>
		error: unknown
	}) {
		// call the onLoad function to match the framework
		let hookCall
		if (variant === 'before') {
			hookCall = (hookFn as KitBeforeLoad).call(this, this.loadEvent as BeforeLoadArgs)
		} else if (variant === 'after') {
			// we have to assign input and data onto load so that we don't read values that
			// are deprecated and generate warnings when read
			hookCall = (hookFn as KitAfterLoad).call(this, {
				event: this.loadEvent,
				input,
				data: Object.fromEntries(
					Object.entries(data).map(([key, store]) => [
						key,
						get<QueryResult<any, any>>(store).data,
					])
				),
			} as AfterLoadArgs)
		} else if (variant === 'error') {
			hookCall = (hookFn as KitOnError).call(this, {
				event: this.loadEvent,
				input,
				error,
			} as OnErrorArgs)
		}

		// make sure any promises are resolved
		let result = await hookCall

		// If the returnValue is already set through this.error or this.redirect return early
		if (!this.continue) {
			return
		}
		// If the result is null or undefined, or the result isn't an object return early
		if (result == null || typeof result !== 'object') {
			return
		}

		this.returnValue = result
	}

	// compute the inputs for an operation should reflect the framework's conventions.
	async computeInput({
		variableFunction,
		artifact,
	}: {
		variableFunction: KitBeforeLoad
		artifact: QueryArtifact | MutationArtifact | SubscriptionArtifact
	}) {
		// call the variable function to match the framework
		let input = await variableFunction.call(this, this.loadEvent)

		return await marshalInputs({ artifact, input })
	}
}

type KitBeforeLoad = (ctx: BeforeLoadArgs) => Record<string, any> | Promise<Record<string, any>>
type KitAfterLoad = (ctx: AfterLoadArgs) => Record<string, any>
type KitOnError = (ctx: OnErrorArgs) => Record<string, any>

const sessionSentinel = {}
// @ts-ignore
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
	// @ts-ignore
	val: App.Session
) {
	if (!isBrowser) {
		return
	}

	session = val
}

// @ts-ignore
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
	// @ts-ignore
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
			// @ts-ignore
			return extractSession(event.data) || sessionSentinel
		} else {
			// this is a client side event -> await the parent data which include the session
			return extractSession((await event.parent()) as any) || sessionSentinel
		}
	}

	return session
}
