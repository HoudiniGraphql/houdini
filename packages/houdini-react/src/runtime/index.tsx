import type { Cache } from '$houdini/runtime/cache/cache'
import { DocumentStore } from '$houdini/runtime/client'
import { GraphQLObject, GraphQLVariables, QueryArtifact } from '$houdini/runtime/lib/types'
import React from 'react'

import client from './client'
import manifest from './manifest'
import { Router as RouterImpl, RouterContextProvider } from './routing'
import { PendingCache } from './routing/components/Router'
import { SuspenseCache } from './routing/lib/cache'

export * from './hooks'
export * from './routing'

export function Router({
	cache,
	artifact_cache,
	component_cache,
	data_cache,
	pending_cache,
}: {
	cache: Cache
	artifact_cache: SuspenseCache<QueryArtifact>
	component_cache: SuspenseCache<(props: any) => React.ReactElement>
	data_cache: SuspenseCache<DocumentStore<GraphQLObject, GraphQLVariables>>
	pending_cache: PendingCache
}) {
	return (
		<RouterContextProvider
			client={client}
			cache={cache}
			artifact_cache={artifact_cache}
			component_cache={component_cache}
			data_cache={data_cache}
			pending_cache={pending_cache}
		>
			<RouterImpl manifest={manifest} />
		</RouterContextProvider>
	)
}
