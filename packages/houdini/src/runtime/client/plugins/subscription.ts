import { ArtifactKind } from '../../lib'
import { ClientPlugin } from '../documentObserver'
import { documentPlugin } from '../utils'

export function subscriptionPlugin(client: SubscriptionHandler): ClientPlugin {
	return documentPlugin(ArtifactKind.Subscription, () => {
		// the unsubscribe hook for the active subscription
		let clearSubscription: null | (() => void) = null

		return {
			setup: {
				enter(ctx, { next, resolve, variablesChanged }) {
					// if the variables havent changed since the last time we ran this,
					// there's nothing to do
					if (!variablesChanged(ctx)) {
						resolve(ctx, {})
						return
					}

					// the variables _have_ changed so move onto the next step
					next(ctx)
				},
			},
			network: {
				enter(ctx, { resolve, marshalVariables }) {
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
								resolve(ctx, { result: { data, errors: [...(errors ?? [])] } })
							},
							error(data) {
								clearSubscription?.()
								resolve(ctx, { ...data })
							},
							complete() {},
						}
					)
				},
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
			next: (payload: { data?: {}; errors?: readonly { message: string }[] }) => void
			error: (data: {}) => void
			complete: () => void
		}
	) => () => void
}
