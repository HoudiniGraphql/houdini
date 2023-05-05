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
	loaded_queries,
	loaded_artifacts,
}: {
	intialURL: string
	cache: Cache
	loaded_queries?: Record<string, { data: GraphQLObject; variables: GraphQLVariables }>
	loaded_artifacts?: Record<string, QueryArtifact>
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
			<RouterImpl
				intialURL={intialURL}
				manifest={manifest}
				loaded_queries={loaded_queries}
				loaded_artifacts={loaded_artifacts}
			/>
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

export function router_cache({
	pending_queries = [],
	artifacts = {},
	components = {},
}: {
	pending_queries?: string[]
	artifacts?: Record<string, QueryArtifact>
	components?: Record<string, (props: any) => React.ReactElement>
} = {}): RouterCache {
	const result: RouterCache = {
		artifact_cache: suspense_cache(),
		component_cache: suspense_cache(),
		data_cache: suspense_cache(),
		pending_cache: suspense_cache(),
		last_variables: suspense_cache(),
	}

	// we need to fill each query with an externally resolvable promise
	for (const query of pending_queries) {
		result.pending_cache.set(query, signal_promise())
	}

	for (const [name, artifact] of Object.entries(artifacts)) {
		result.artifact_cache.set(name, artifact)
	}

	for (const [name, component] of Object.entries(components)) {
		result.component_cache.set(name, component)
	}

	return result
}

// a signal promise is a promise is used to send signals by having listeners attach
// actions to the then()
function signal_promise(): Promise<void> & { resolve: () => void; reject: () => void } {
	let resolve: () => void = () => {}
	let reject: () => void = () => {}
	const promise = new Promise<void>((res, rej) => {
		resolve = res
		reject = rej
	})

	return {
		...promise,
		resolve,
		reject,
	}
}
