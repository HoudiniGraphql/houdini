import type { DocumentArtifact } from '../../lib/types'
import type { ClientPlugin, ClientPluginContext } from '../documentStore'

export type FetchParamFn = (ctx: FetchParamsInput) => Required<ClientPluginContext>['fetchParams']

export const fetchParams: (fn?: FetchParamFn) => ClientPlugin =
	(fn = () => ({})) =>
	() => ({
		start(ctx, { next, marshalVariables }) {
			// before we move onto the next plugin, we need to strip the variables as they go through
			if (ctx.variables) {
				for (const variable of ctx.artifact.stripVariables) {
					delete ctx.variables[variable]
					delete ctx.stuff.inputs.marshaled[variable]
				}
			}

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
					text: ctx.text,
					hash: ctx.hash,
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
