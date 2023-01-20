import type { DocumentArtifact } from '../../lib/types'
import type { ClientPlugin, ClientPluginContext } from '../documentObserver'

export type FetchParamFn = (ctx: FetchparamsInput) => Required<ClientPluginContext>['fetchParams']

export const fetchParamsPlugin: (fn?: FetchParamFn) => ClientPlugin =
	(fn = () => ({})) =>
	() => ({
		beforeNetwork(ctx, { next, marshalVariables }) {
			next({
				...ctx,
				fetchParams: fn({
					...ctx,
					variables: marshalVariables(ctx),
					text: ctx.artifact.raw,
					hash: ctx.artifact.hash,
				}),
			})
		},
	})

export type FetchparamsInput = Pick<
	ClientPluginContext,
	'config' | 'policy' | 'variables' | 'metadata' | 'session' | 'stuff'
> & {
	text: string
	hash: string
	artifact: DocumentArtifact
}
