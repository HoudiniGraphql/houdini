import type { ClientPlugin } from 'houdini/runtime/client'

import devtools from './devtools/plugin.js'

const plugin: () => ClientPlugin = () => () => {
	return [
		{
			start(ctx, { next }) {
				next({
					...ctx,
					cacheParams: {
						...ctx.cacheParams,
						serverSideFallback: false,
					},
				})
			},
		},
		devtools,
	]
}

export default plugin
