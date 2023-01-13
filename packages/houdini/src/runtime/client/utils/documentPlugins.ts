import { ArtifactKind, GraphQLObject } from '../../lib'
import { ClientPlugin, ClientPluginPhase } from '../documentObserver'

export const documentPlugin = (kind: ArtifactKind, source: ClientPlugin): ClientPlugin => {
	return () => {
		// pull out the hooks we care about
		const sourceHandlers = source()

		// a function to conditionally invoke the hooks if the artifact has the right kind
		const wrap = (sourceHook?: ClientPluginPhase): ClientPluginPhase =>
			!sourceHook
				? {}
				: {
						enter(ctx, handlers) {
							if (ctx.artifact.kind !== kind || !sourceHook.enter) {
								return handlers.next(ctx)
							}
							return sourceHook.enter(ctx, handlers)
						},
						exit(ctx, handlers) {
							if (ctx.artifact.kind !== kind || !sourceHook.exit) {
								return handlers.resolve(ctx)
							}
							return sourceHook.exit(ctx, handlers)
						},
				  }

		// return the modified hooks
		return {
			setup: wrap(sourceHandlers.setup),
			network: wrap(sourceHandlers.network),
			throw: (ctx, handlers) => {
				if (ctx.artifact.kind !== kind || !sourceHandlers.throw) {
					return handlers.next(ctx)
				}
				return sourceHandlers.throw(ctx, handlers)
			},
			cleanup: () => sourceHandlers.cleanup?.(),
		}
	}
}
