import type { ArtifactKind } from '../../lib/types'
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
						enter: !sourceHook.enter
							? undefined
							: (ctx, handlers) => {
									if (ctx.artifact.kind !== kind) {
										return handlers.next(ctx)
									}
									return sourceHook.enter!(ctx, handlers)
							  },
						exit: !sourceHook.exit
							? undefined
							: (ctx, handlers) => {
									if (ctx.artifact.kind !== kind) {
										return handlers.resolve(ctx)
									}
									return sourceHook.exit!(ctx, handlers)
							  },
				  }

		// return the modified hooks
		return {
			setup: wrap(sourceHandlers.setup),
			network: wrap(sourceHandlers.network),
			throw: sourceHandlers.throw
				? (ctx, handlers) => sourceHandlers.throw!(ctx, handlers)
				: undefined,
			cleanup: () => sourceHandlers.cleanup?.(),
		}
	}
}
