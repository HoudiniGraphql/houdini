import type { Cache } from '../../cache/cache'
import { deepEquals } from '../../lib/deepEquals'
import { type SubscriptionSpec, ArtifactKind, DataSource } from '../../lib/types'
import { documentPlugin } from '../utils'

// the purpose of the fragment plugin is to provide fine-reactivity for cache updates
// there are no network requests that get sent. send() always returns the initial value
export const fragment = (cache: Cache) =>
	documentPlugin(ArtifactKind.Fragment, function () {
		// track the bits of state we need to hold onto
		let subscriptionSpec: SubscriptionSpec | null = null

		// we need to track the last parents and variables used so we can re-subscribe
		let lastReference: { parent: string; variables: any } | null = null

		return {
			// establish the cache subscription
			start(ctx, { next, resolve, variablesChanged, marshalVariables }) {
				// if there's no parent id, there's nothing to do
				if (!ctx.stuff.parentID) {
					return next(ctx)
				}

				// the object describing the current parent reference
				const currentReference = {
					parent: ctx.stuff.parentID,
					variables: marshalVariables(ctx),
				}

				// if the variables have changed we need to setup a new subscription with the cache
				if (
					!ctx.cacheParams?.disableSubscriptions &&
					(!deepEquals(lastReference, currentReference) || variablesChanged(ctx))
				) {
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

					lastReference = currentReference
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
