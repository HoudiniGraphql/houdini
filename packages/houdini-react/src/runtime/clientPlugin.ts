import type { ClientPlugin } from 'houdini'

const plugin: () => ClientPlugin = () => () => {
	return {
		beforeNetwork(ctx, { next }) {
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
