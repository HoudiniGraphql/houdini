import type { ArtifactKinds } from '../../lib/types'
import type {
	ClientPlugin,
	ClientPluginExitPhase,
	ClientPluginEnterPhase,
	ClientHooks,
} from '../documentStore'

export const documentPlugin = (kind: ArtifactKinds, source: () => ClientHooks): ClientPlugin => {
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
			beforeNetwork: enterWrapper(sourceHandlers.beforeNetwork),
			afterNetwork: exitWrapper(sourceHandlers.afterNetwork),
			end: exitWrapper(sourceHandlers.end),
			catch: sourceHandlers.catch
				? (ctx, handlers) => sourceHandlers.catch!(ctx, handlers)
				: undefined,
			cleanup: (...args) => sourceHandlers.cleanup?.(...args),
		}
	}
}
