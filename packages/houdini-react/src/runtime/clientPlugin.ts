import type { ClientPlugin } from 'houdini'

const plugin: () => ClientPlugin = () => () => {
	return {
		beforeNetwork(ctx, { next }) {
			next({
				...ctx,
				cacheParams: {
					...ctx.fetchParams,
					serverSideFallback: false,
				},
			})
		},
	}
}

export default plugin
