import { deepEquals } from '../../lib/deepEquals'
import { ArtifactKind, DataSource } from '../../lib/types'
import type { ClientPluginContext } from '../documentStore'
import { documentPlugin } from '../utils'

export function subscriptionPlugin(factory: SubscriptionHandler) {
	return documentPlugin(ArtifactKind.Subscription, () => {
		// the unsubscribe hook for the active subscription
		let clearSubscription: null | (() => void) = null

		// when we detect a new fetchParams we need to recreate the socket client
		let socketClient: ReturnType<SubscriptionHandler> | null = null

		// we need to re-run the subscription if the following object has changed
		let check: {
			fetchParams: RequestInit
			session: App.Session
			metadata: App.Metadata
		} | null = null

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
			network(ctx, { resolve, initialValue, variablesChanged, marshalVariables }) {
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

				// if we got this far, we need to clear the subscription before we
				// create a new one
				clearSubscription?.()

				// if the socket client hasn't been made yet then do so with the current context
				// if the session has also changed then recreate the client
				if (!socketClient || sessionChange) {
					socketClient = factory(ctx)
				}

				// start listening for the new subscription
				clearSubscription = socketClient.subscribe(
					{
						query: ctx.artifact.raw,
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
								variables: ctx.variables ?? null,
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
								variables: ctx.variables ?? null,
							})
						},
						complete() {},
					}
				)
			},
			cleanup() {
				clearSubscription?.()
			},
		}
	})
}

export type SubscriptionHandler = (ctx: ClientPluginContext) => {
	subscribe: (
		payload: { query: string; variables?: {} },
		handlers: {
			next: (payload: { data?: {} | null; errors?: readonly { message: string }[] }) => void
			error: (data: {}) => void
			complete: () => void
		}
	) => () => void
}
