import type { ArtifactKind } from '../../lib/types'
import type { ClientPlugin, ClientPluginExitPhase, ClientPluginEnterPhase } from '../documentStore'

export const documentPlugin = (kind: ArtifactKind, source: ClientPlugin): ClientPlugin => {
	return () => {
		// pull out the hooks we care about
		const sourceHandlers = source()

		const enterWrapper = (
			handler?: ClientPluginEnterPhase
		): ClientPluginEnterPhase | undefined => {
			return !handler
				? undefined
				: (ctx, handlers) => {
						if (ctx.artifact.kind !== kind) {
							return handlers.next(ctx)
						}

						return handler(ctx, handlers)
				  }
		}
		const exitWrapper = (
			handler?: ClientPluginExitPhase
		): ClientPluginExitPhase | undefined => {
			return !handler
				? undefined
				: (ctx, handlers) => {
						if (ctx.artifact.kind !== kind) {
							return handlers.resolve(ctx)
						}

						return handler(ctx, handlers)
				  }
		}

		// return the modified hooks
		return {
			start: enterWrapper(sourceHandlers.start),
			network: enterWrapper(sourceHandlers.network),
			afterNetwork: exitWrapper(sourceHandlers.afterNetwork),
			end: exitWrapper(sourceHandlers.end),
			throw: sourceHandlers.throw
				? (ctx, handlers) => sourceHandlers.throw!(ctx, handlers)
				: undefined,
			cleanup: (...args) => sourceHandlers.cleanup?.(...args),
		}
	}
}
