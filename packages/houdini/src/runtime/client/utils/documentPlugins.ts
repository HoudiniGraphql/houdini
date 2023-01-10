import { ArtifactKind } from '../../lib'
import { ClientPlugin, ClientPluginPhase } from '../documentObserver'

export const documentPlugin = (kind: ArtifactKind, source: ClientPlugin): ClientPlugin => {
	return () => {
		// pull out the hooks we care about
		const { setup, network, error, cleanup, ...rest } = source()

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
			setup: wrap(setup),
			network: wrap(network),
			error: (ctx, handlers) => {
				if (ctx.artifact.kind !== kind || !error) {
					return handlers.next(ctx)
				}
				return error(ctx, handlers)
			},
			cleanup: () => cleanup?.(),
		}
	}
}
