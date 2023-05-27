import { deepEquals } from '../../lib/deepEquals'
import { ArtifactKind, DataSource } from '../../lib/types'
import type { ClientPluginContext } from '../documentStore'
import { documentPlugin } from '../utils'

// we need to re-run the subscription if the following object has changed.
// this is only safe because this plugin only operates on the client
let check: {
	fetchParams: RequestInit
	session: App.Session
	metadata: App.Metadata
} | null = null

export function subscription(factory: SubscriptionHandler) {
	return documentPlugin(ArtifactKind.Subscription, () => {
		// the unsubscribe hook for the active subscription
		let clearSubscription: null | (() => void) = null

		return {
			start(ctx, { resolve, next, initialValue }) {
				// we can only start a websocket client if we're on the browser
				if (typeof globalThis.window === 'undefined') {
					resolve(ctx, initialValue)
					return
				}

				// its safe to keep going
				next(ctx)
			},
			async network(ctx, { resolve, initialValue, variablesChanged, marshalVariables }) {
				const checkValue = {
					fetchParams: ctx.fetchParams ?? {},
					session: ctx.session ?? {},
					metadata: ctx.metadata ?? {},
				}
				// if the variables havent changed since the last time we ran this,
				// there's nothing to do
				const changed = variablesChanged(ctx)
				const sessionChange = !deepEquals(check, checkValue)
				if (!changed && !sessionChange) {
					resolve(ctx, initialValue)
					return
				}

				// we need to use this as the new check value
				check = checkValue

				// if the session has changed then recreate the client
				if (sessionChange) {
					await loadClient(ctx, factory)
				}

				// if we got this far, we need to clear the subscription before we
				// create a new one
				clearSubscription?.()

				// start listening for the new subscription
				clearSubscription = client.subscribe(
					{
						operationName: ctx.name,
						query: ctx.text,
						variables: marshalVariables(ctx),
					},
					{
						next: ({ data, errors }) => {
							resolve(ctx, {
								data: data ?? null,
								errors: [...(errors ?? [])],
								fetching: false,
								partial: true,
								stale: false,
								source: DataSource.Network,
								variables: ctx.variables ?? {},
							})
						},
						error(data) {
							clearSubscription?.()
							resolve(ctx, {
								partial: true,
								stale: false,
								source: DataSource.Network,
								data: null,
								errors: [data as Error],
								fetching: false,
								variables: ctx.variables ?? {},
							})
						},
						complete() {},
					}
				)
			},
			cleanup() {
				clearSubscription?.()
				// clear the check so we already recreate the connection next time
				check = null
			},
		}
	})
}

export type SubscriptionHandler = (ctx: ClientPluginContext) => SubscriptionClient

export type SubscriptionClient = {
	subscribe: (
		payload: {
			operationName?: string
			query: string
			variables?: Record<string, unknown> | null
			extensions?: Record<'persistedQuery', string> | Record<string, unknown> | null
		},
		handlers: {
			next: (payload: { data?: {} | null; errors?: readonly { message: string }[] }) => void
			error: (data: {}) => void
			complete: () => void
		}
	) => () => void
}

// if 2 subscriptions start at the same time we don't want to create
// multiple clients. We'll make a global promise that we will use to
// coordinate across invocations of the plugin. This is only safe to do
// without considering user-sessions on the server because this plugin
// ensures that it only runs on the browser in the start phase
let pendingCreate: Promise<void> | null = null

// the actual client
let client: SubscriptionClient

function loadClient(
	ctx: ClientPluginContext,
	factory: (ctx: ClientPluginContext) => SubscriptionClient
): Promise<void> {
	// if we are currently loading a client, just wait for that
	if (pendingCreate) {
		return pendingCreate
	}

	// we aren't currently loading the client so we're safe to do that
	// and register the effort to coordinate other subscriptions
	pendingCreate = new Promise((resolve) => {
		// update the client reference
		client = factory(ctx)

		// we're done
		resolve()

		// we're done with the create
		pendingCreate = null
	})

	return pendingCreate
}
