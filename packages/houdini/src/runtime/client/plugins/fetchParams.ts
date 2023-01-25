import type { DocumentArtifact } from '../../lib/types'
import type { ClientPlugin, ClientPluginContext } from '../documentStore'

export type FetchParamFn = (ctx: FetchParamsInput) => Required<ClientPluginContext>['fetchParams']

export const fetchParamsPlugin: (fn?: FetchParamFn) => ClientPlugin =
	(fn = () => ({})) =>
	() => ({
		beforeNetwork(ctx, { next, marshalVariables }) {
			next({
				...ctx,
				fetchParams: fn({
					// most of the stuff comes straight from the context
					config: ctx.config,
					policy: ctx.policy,
					metadata: ctx.metadata,
					session: ctx.session,
					stuff: ctx.stuff,
					// a few fields are renamed or modified
					document: ctx.artifact,
					variables: marshalVariables(ctx),
					text: ctx.artifact.raw,
					hash: ctx.artifact.hash,
				}),
			})
		},
	})

export type FetchParamsInput = Pick<
	ClientPluginContext,
	'config' | 'policy' | 'variables' | 'metadata' | 'session' | 'stuff'
> & {
	text: string
	hash: string
	document: DocumentArtifact
}
