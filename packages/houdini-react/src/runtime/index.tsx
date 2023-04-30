import type { Cache } from '$houdini/runtime/cache/cache'
import { LRUCache } from '$houdini/runtime/lib/lru'
import { QueryArtifact } from '$houdini/runtime/lib/types'
import React from 'react'

import client from './client'
import manifest from './manifest'
import { Router as RouterImpl, RouterContextProvider } from './routing'

export * from './hooks'
export * from './routing'

export function Router({ cache }: { cache: Cache }) {
	return (
		<RouterContextProvider client={client} cache={cache}>
			<RouterImpl manifest={manifest} />
		</RouterContextProvider>
	)
}
