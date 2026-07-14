import type { RuntimeScalarPayload } from 'houdini'
import type { Cache } from 'houdini/runtime/cache'
import { type SubscriptionSpec, ArtifactKind, CachePolicy, DataSource } from 'houdini/runtime/types'

import { documentPlugin } from './utils/index.js'

export const query = (cache: Cache) =>
	documentPlugin(ArtifactKind.Query, () => {
		// track the bits of state we need to hold onto
		let subscriptionSpec: SubscriptionSpec | null = null

		// remember the last variables we were called with
		let lastVariables: Record<string, any> | null = null

		// track the most recent session so that refetch requests triggered by
		// record.refresh() use the current auth token, not the one from when the
		// subscription was first created
		let lastSession: App.Session | null | undefined = null
		let lastMetadata: App.Metadata | null | undefined = null

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
								const runtimeScalar = ctx.config.runtimeScalars?.[type]
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
				// always keep the session current so that a later record.refresh() call
				// uses the auth token from the most recent send(), not from subscription time
				lastSession = ctx.session
				lastMetadata = ctx.metadata

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
						kind: ctx.artifact.kind,
						selection: ctx.artifact.selection,
						variables: () => variables,
						onMessage: (message) => {
							// if the cache asked us to refetch, kick off a brand new request
							// through the full pipeline so the document reloads from the API
							if (message.kind === 'refetch') {
								ctx.documentStore.send({
									policy: message.policy ?? CachePolicy.NetworkOnly,
									metadata: message.metadata ?? lastMetadata,
									abortController: message.abortController,
									session: 'session' in message ? message.session : lastSession,
								})
								return
							}

							resolve(ctx, {
								data: message.data,
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
