import { getCache } from '$houdini/runtime'
import type { Cache } from '$houdini/runtime/cache/cache'
import React from 'react'

import client from './client'
import manifest from './manifest'
import { Router as RouterImpl } from './routing/router'

export function Router({ cache = getCache() }: { cache: Cache }) {
	return <RouterImpl cache={cache} manifest={manifest} client={client} />
}
