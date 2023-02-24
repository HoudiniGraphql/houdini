import cache from '../../cache'
import { type SubscriptionSpec, ArtifactKind, DataSource } from '../../lib/types'
import type { ClientPlugin } from '../documentStore'
import { documentPlugin } from '../utils'

// the purpose of the fragment plugin is to provide fine-reactivity for cache updates
// there are no network requests that get sent. send() always returns the initial value
export const fragment: ClientPlugin = documentPlugin(ArtifactKind.Fragment, function () {
	// track the bits of state we need to hold onto
	let subscriptionSpec: SubscriptionSpec | null = null

	return {
		// establish the cache subscription
		start(ctx, { next, resolve, variablesChanged, marshalVariables }) {
			// if there's no parent id, there's nothing to do
			if (!ctx.stuff.parentID) {
				return next(ctx)
			}

			// if the variables have changed we need to setup a new subscription with the cache
			if (variablesChanged(ctx)) {
				// if the variables changed we need to unsubscribe from the old fields and
				// listen to the new ones
				if (subscriptionSpec) {
					cache.unsubscribe(subscriptionSpec, subscriptionSpec.variables?.() || {})
				}

				// we need to subscribe with the marshaled variables
				const variables = marshalVariables(ctx)

				// save the new subscription spec
				subscriptionSpec = {
					rootType: ctx.artifact.rootType,
					selection: ctx.artifact.selection,
					variables: () => variables,
					parentID: ctx.stuff.parentID,
					set: (newValue) => {
						resolve(ctx, {
							data: newValue,
							errors: null,
							fetching: false,
							partial: false,
							stale: false,
							source: DataSource.Cache,
							variables,
						})
					},
				}

				// make sure we subscribe to the new values
				cache.subscribe(subscriptionSpec, variables)
			}

			// we're done
			next(ctx)
		},

		cleanup() {
			if (subscriptionSpec) {
				cache.unsubscribe(subscriptionSpec, subscriptionSpec.variables?.())
			}
		},
	}
})
