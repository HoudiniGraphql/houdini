import * as log from '$houdini/runtime/lib/log'

import type { QueryResult, ArtifactKinds } from '../../lib'
import { ArtifactKind } from '../../lib'
import type { ClientPlugin, ClientPluginContext } from '../documentStore'

export type ThrowOnErrorOperations = 'all' | 'query' | 'mutation' | 'subscription'

export type ThrowOnErrorParams = {
	operations: ThrowOnErrorOperations[]
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
				if (operations.includes('all') || operations.includes('query')) {
					// if explicitly set to not_always_blocking, we can't throw, so warn the user.
					const config_not_always_blocking =
						(ctx.config.plugins as any)['houdini-svelte']?.defaultBlockingMode ===
						'not_always_blocking'
					if (config_not_always_blocking) {
						log.info(
							'[Houdini] ⚠️ throwOnError with operation "all" or "query", is not compatible with defaultBlockingMode set to "not_always_blocking"'
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
