import type { Cache } from '../../cache/cache'
import type { RuntimeScalarPayload } from '../../lib'
import { type SubscriptionSpec, ArtifactKind, DataSource } from '../../lib/types'
import { documentPlugin } from '../utils'

export const query = (cache: Cache) =>
	documentPlugin(ArtifactKind.Query, function () {
		// track the bits of state we need to hold onto
		let subscriptionSpec: SubscriptionSpec | null = null

		// remember the last variables we were called with
		let lastVariables: Record<string, any> | null = null

		// the function to call when a query is sent
		return {
			start(ctx, { next }) {
				const runtimeScalarPayload: RuntimeScalarPayload = {
					session: ctx.session,
				}

				// make sure to include the last variables as well as the new ones
				ctx.variables = {
					...lastVariables,
					// we need to evaluate any runtime scalars but allow the user to overwrite them
					// by explicitly passing variables
					...Object.fromEntries(
						Object.entries(ctx.artifact.input?.runtimeScalars ?? {}).map(
							([field, type]) => {
								const runtimeScalar = ctx.config.features?.runtimeScalars?.[type]
								// make typescript happy
								if (!runtimeScalar) {
									return [field, type]
								}

								// resolve the runtime scalar
								return [field, runtimeScalar.resolve(runtimeScalarPayload)]
							}
						)
					),
					...ctx.variables,
				}
				next(ctx)
			},

			// patch subscriptions on the way out so that we don't get a cache update
			// before the promise resolves
			end(ctx, { resolve, marshalVariables, variablesChanged }) {
				// if the variables have changed we need to setup a new subscription with the cache
				if (variablesChanged(ctx) && !ctx.cacheParams?.disableSubscriptions) {
					// if the variables changed we need to unsubscribe from the old fields and
					// listen to the new ones
					if (subscriptionSpec) {
						cache.unsubscribe(subscriptionSpec, subscriptionSpec.variables?.() || {})
					}

					// track the new variables
					lastVariables = { ...marshalVariables(ctx) }

					const variables = lastVariables
					// save the new subscription spec
					subscriptionSpec = {
						rootType: ctx.artifact.rootType,
						selection: ctx.artifact.selection,
						variables: () => variables,
						set: (newValue) => {
							resolve(ctx, {
								data: newValue,
								errors: null,
								fetching: false,
								partial: false,
								stale: false,
								source: DataSource.Cache,
								variables: ctx.variables ?? {},
							})
						},
					}

					// make sure we subscribe to the new values
					cache.subscribe(subscriptionSpec, lastVariables)
				}

				// we are done
				resolve(ctx)
			},
			cleanup() {
				if (subscriptionSpec) {
					cache.unsubscribe(subscriptionSpec, subscriptionSpec.variables?.())
					lastVariables = null
				}
			},
		}
	})
