import type { Cache } from '$houdini/runtime/cache/cache'
import { DocumentStore } from '$houdini/runtime/client'
import { LRUCache } from '$houdini/runtime/lib/lru'
import { GraphQLObject, GraphQLVariables, QueryArtifact } from '$houdini/runtime/lib/types'
import React from 'react'

import client from './client'
import manifest from './manifest'
import { Router as RouterImpl, RouterContextProvider } from './routing'
import { PendingCache } from './routing/components/Router'
import { SuspenseCache, suspense_cache } from './routing/lib/cache'

export * from './hooks'
export * from './routing'

export function Router({
	cache,
	intialURL,
	artifact_cache,
	component_cache,
	data_cache,
	pending_cache,
	last_variables,
}: {
	intialURL: string
	cache: Cache
} & RouterCache) {
	return (
		<RouterContextProvider
			client={client}
			cache={cache}
			artifact_cache={artifact_cache}
			component_cache={component_cache}
			data_cache={data_cache}
			pending_cache={pending_cache}
			last_variables={last_variables}
		>
			<RouterImpl intialURL={intialURL} manifest={manifest} />
		</RouterContextProvider>
	)
}

type RouterCache = {
	artifact_cache: SuspenseCache<QueryArtifact>
	component_cache: SuspenseCache<(props: any) => React.ReactElement>
	data_cache: SuspenseCache<DocumentStore<GraphQLObject, GraphQLVariables>>
	last_variables: LRUCache<GraphQLVariables>
	pending_cache: PendingCache
}

export function router_cache(): RouterCache {
	return {
		artifact_cache: suspense_cache(),
		component_cache: suspense_cache(),
		data_cache: suspense_cache(),
		pending_cache: suspense_cache(),
		last_variables: suspense_cache(),
	}
}
