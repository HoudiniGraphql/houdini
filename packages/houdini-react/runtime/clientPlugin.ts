import type { ClientPlugin } from 'houdini/runtime/client'

const plugin: () => ClientPlugin = () => () => {
	return {
		start(ctx, { next }) {
			next({
				...ctx,
				cacheParams: {
					...ctx.cacheParams,
					serverSideFallback: false,
				},
			})
		},
	}
}

export default plugin
