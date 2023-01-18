import cache from '../../cache'
import { type SubscriptionSpec, ArtifactKind, DataSource } from '../../lib/types'
import type { ClientPlugin } from '../documentObserver'
import { documentPlugin } from '../utils'

export const queryPlugin: ClientPlugin = documentPlugin(ArtifactKind.Query, function () {
	// track the bits of state we need to hold onto
	let subscriptionSpec: SubscriptionSpec | null = null

	// remember the last variables we were called with
	let lastVariables: Record<string, any> | null = null

	let artifactName: string = ''
	// the function to call when a query is sent
	return {
		start(ctx, { next }) {
			// make sure to include the last variables as well as the new ones
			ctx.variables = {
				...lastVariables,
				...ctx.variables,
			}
			next(ctx)
		},

		// patch subscriptions on the way out so that we don't get a cache update
		// before the promise resolves
		end(ctx, { resolve, marshalVariables, variablesChanged }) {
			// if the variables have changed we need to setup a new subscription with the cache
			if (variablesChanged(ctx)) {
				artifactName = ctx.artifact.name
				// if the variables changed we need to unsubscribe from the old fields and
				// listen to the new ones
				if (subscriptionSpec) {
					cache.unsubscribe(subscriptionSpec, subscriptionSpec.variables?.() || {})
				}

				// track the new variables
				lastVariables = { ...marshalVariables(ctx) }

				// save the new subscription spec
				subscriptionSpec = {
					rootType: ctx.artifact.rootType,
					selection: ctx.artifact.selection,
					variables: () => lastVariables,
					set: (newValue) => {
						console.log('setting from cache update')
						resolve(ctx, {
							data: newValue,
							errors: null,
							fetching: false,
							partial: false,
							source: DataSource.Cache,
							variables: ctx.variables ?? null,
						})
					},
				}

				// make sure we subscribe to the new values
				cache.subscribe(subscriptionSpec, lastVariables ?? {})
			}

			// we are done
			resolve(ctx)
		},
		cleanup() {
			if (subscriptionSpec) {
				cache.unsubscribe(subscriptionSpec, subscriptionSpec.variables?.() ?? {})
				lastVariables = null
			}
		},
	}
})
