import { getFieldsForType } from '$houdini/runtime/lib/selection'
import type { ClientPlugin, DocumentArtifact, GraphQLValue } from 'houdini'
import React from 'react'

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
