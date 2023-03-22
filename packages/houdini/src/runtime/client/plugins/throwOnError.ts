import type { QueryResult, ArtifactKinds } from '../../lib'
import { ArtifactKind } from '../../lib'
import type { ClientPlugin, ClientPluginContext } from '../documentStore'

export type ThrowOnErrorParams = {
	operations: ('all' | 'query' | 'mutation' | 'subscription')[]
	error?: (
		errors: NonNullable<QueryResult<any, any>['errors']>,
		ctx: ClientPluginContext
	) => unknown
}

export const throwOnError =
	({ operations, error }: ThrowOnErrorParams): ClientPlugin =>
	() => {
		// build a map of artifact kinds we will throw on
		const all = operations.includes('all')
		const throwOnKind = (kind: ArtifactKinds) =>
			all ||
			{
				[ArtifactKind.Query]: operations.includes('query'),
				[ArtifactKind.Mutation]: operations.includes('mutation'),
				[ArtifactKind.Fragment]: false,
				[ArtifactKind.Subscription]: operations.includes('subscription'),
			}[kind]

		return {
			async start(ctx, { next }) {
				// add a warning if the config is wrong
				if (throwOnKind(ctx.artifact.kind) && ctx.artifact.kind === ArtifactKind.Query) {
					// if explicitly set to not_always_blocking, we can't throw, so warn the user.
					if (ctx.config.defaultBlockingMode === 'not_always_blocking') {
						console.error(
							'[Houdini][client-plugin] throwOnError with operation "all" or "query", is not compatible with defaultBlockingMode set to "not_always_blocking"'
						)
					}
					// if it's not explicitly set, we can't throw, so warn the user to add in the config.
					else if (ctx.config.defaultBlockingMode !== 'always_blocking') {
						console.error(
							'[Houdini][client-plugin] throwOnError can work properly only if you set defaultBlockingMode to "always_blocking" in the config'
						)
					}
				}
				next(ctx)
			},
			async end(ctx, { value, resolve }) {
				// if we are supposed to throw and there are errors
				if (value.errors && value.errors.length > 0 && throwOnKind(ctx.artifact.kind)) {
					const result = await (error ?? defaultErrorFn)(value.errors, ctx)
					throw result
				}

				// we're not supposed to throw, move on
				resolve(ctx)
			},
		}
	}

const defaultErrorFn: Required<ThrowOnErrorParams>['error'] = async (errors) =>
	new Error(errors.map((error) => error.message).join('. ') + '.')
