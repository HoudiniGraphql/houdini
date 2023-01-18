import type { QueryResult } from '../../lib'
import { ArtifactKind } from '../../lib'
import type { ClientPlugin } from '../documentObserver'

export type ThrowOnErrorParams = {
	operations: (`all` | 'query' | 'mutation' | 'subscription')[]
	error?: (errors: NonNullable<QueryResult<any, any>['errors']>) => unknown
}

export const throwOnErrorPlugin =
	({ operations, error }: ThrowOnErrorParams): ClientPlugin =>
	() => {
		// build a map of artifact kinds we will throw on
		const all = operations.includes('all')
		const throwOnKind = (kind: ArtifactKind) =>
			all ||
			{
				[ArtifactKind.Query]: operations.includes('query'),
				[ArtifactKind.Mutation]: operations.includes('mutation'),
				[ArtifactKind.Fragment]: false,
				[ArtifactKind.Subscription]: operations.includes('subscription'),
			}[kind]

		return {
			async end(ctx, { value, resolve }) {
				// if we are supposed to throw and there are errors
				if (value.errors && value.errors.length > 0 && throwOnKind(ctx.artifact.kind)) {
					const result = await (error ?? defaultErrorFn)(value.errors)
					throw result
				}

				// we're not supposed to throw, move on
				resolve(ctx)
			},
		}
	}

const defaultErrorFn: Required<ThrowOnErrorParams>['error'] = async (errors) =>
	new Error(errors.map((error) => error.message).join('. ') + '.')
