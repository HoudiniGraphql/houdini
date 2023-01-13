import cache from '../../cache'
import { type SubscriptionSpec, ArtifactKind } from '../../lib'
import { type ClientPlugin } from '../documentObserver'
import { documentPlugin } from '../utils'

export const queryPlugin: ClientPlugin = documentPlugin(ArtifactKind.Query, function () {
	// track the bits of state we need to hold onto
	let subscriptionSpec: SubscriptionSpec | null = null

	// remember the last variables we were called with
	let lastVariables: Record<string, any> | null = null

	// the function to call when a query is sent
	return {
		setup: {
			enter(ctx, { next, resolve, marshalVariables, variablesChanged }) {
				// make sure to include the last variables as well as the new ones
				ctx.variables = {
					...lastVariables,
					...ctx.variables,
				}

				// if the variables have changed we need to setup a new subscription with the cache
				if (variablesChanged(ctx)) {
					// if the variables changed we need to unsubscribe from the old fields and
					// listen to the new ones
					if (subscriptionSpec) {
						cache.unsubscribe(subscriptionSpec, subscriptionSpec.variables?.() || {})
					}

					// track the new variables
					lastVariables = marshalVariables(ctx)

					// save the new subscription spec
					subscriptionSpec = {
						rootType: ctx.artifact.rootType,
						selection: ctx.artifact.selection,
						variables: () => marshalVariables(ctx),
						set: (newValue) => resolve(ctx, newValue),
					}

					// make sure we subscribe to the new values
					cache.subscribe(subscriptionSpec, lastVariables ?? {})
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
