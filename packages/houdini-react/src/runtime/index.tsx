import type { Cache } from '$houdini/runtime/cache/cache'
import { LRUCache } from '$houdini/runtime/lib/lru'
import { QueryArtifact } from '$houdini/runtime/lib/types'
import React from 'react'

import client from './client'
import manifest from './manifest'
import { Router as RouterImpl, RouterContextProvider } from './routing'

export * from './hooks'
export * from './routing'

export function Router({ cache, fallback }: { cache: Cache; fallback: React.ReactElement }) {
	return (
		<RouterContextProvider client={client} fallback={fallback}>
			<RouterImpl cache={cache} manifest={manifest} />
		</RouterContextProvider>
	)
}
