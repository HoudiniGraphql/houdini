import type { GraphQLObject } from '../../lib/types'
import { ArtifactKind, DataSource } from '../../lib/types'
import { documentPlugin } from '../utils'

export function subscriptionPlugin(client: SubscriptionHandler) {
	return documentPlugin(ArtifactKind.Subscription, () => {
		// the unsubscribe hook for the active subscription
		let clearSubscription: null | (() => void) = null

		return {
			start(ctx, { next, resolve, variablesChanged, initialValue }) {
				// if the variables havent changed since the last time we ran this,
				// there's nothing to do
				if (!variablesChanged(ctx)) {
					resolve(ctx, initialValue)
					return
				}

				// the variables _have_ changed so move onto the next step
				next(ctx)
			},
			network(ctx, { resolve, marshalVariables }) {
				// if we got this far, we need to clear the subscription before we
				// create a new one
				clearSubscription?.()

				// start listening for the new subscription
				clearSubscription = client.subscribe(
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
								source: DataSource.Network,
								variables: ctx.variables ?? null,
							})
						},
						error(data) {
							clearSubscription?.()
							resolve(ctx, {
								partial: true,
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

export type SubscriptionHandler = {
	subscribe: (
		payload: { query: string; variables?: {} },
		handlers: {
			next: (payload: {
				data?: GraphQLObject
				errors?: readonly { message: string }[]
			}) => void
			error: (data: {}) => void
			complete: () => void
		}
	) => () => void
}
