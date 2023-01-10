import cache from '../../cache'
import { type SubscriptionSpec, ArtifactKind } from '../../lib'
import { type ClientPlugin } from '../documentObserver'
import { documentPlugin } from '../utils'
import { marshaledVariables, variablesChanged } from './inputs'

export const queryPlugin: ClientPlugin = documentPlugin(ArtifactKind.Query, function () {
	// track the bits of state we need to hold onto
	let subscriptionSpec: SubscriptionSpec | null = null

	// the function to call when a query is sent
	return {
		setup: {
			enter(ctx, { next, resolve }) {
				// if the variables have changed we need to setup a new subscription with the cache
				if (variablesChanged(ctx)) {
					// if the variables changed we need to unsubscribe from the old fields and
					// listen to the new ones
					if (subscriptionSpec) {
						cache.unsubscribe(subscriptionSpec, subscriptionSpec.variables?.() || {})
					}

					// save the new subscription spec
					subscriptionSpec = {
						rootType: ctx.artifact.rootType,
						selection: ctx.artifact.selection,
						variables: () => marshaledVariables(ctx),
						set: (newValue) => resolve(ctx, newValue),
					}

					// make sure we subscribe to the new values
					cache.subscribe(subscriptionSpec, marshaledVariables(ctx))
				}

				// we are done
				next(ctx)
			},
		},
		cleanup() {
			if (subscriptionSpec) {
				cache.unsubscribe(subscriptionSpec, subscriptionSpec.variables?.() ?? {})
			}
		},
	}
})
