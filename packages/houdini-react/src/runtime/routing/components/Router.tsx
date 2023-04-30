import type { Cache } from '$houdini/runtime/cache/cache'
import { HoudiniClient } from '$houdini/runtime/client'
import React from 'react'

import { find_match } from '../lib/match'
import type { RouterManifest } from '../lib/types'

/**
 * Router is the top level entry point for the filesystem-based router.
 * It is responsible for loading various page sources, sending the necessary
 * data for each page, and then rendering when appropriate.
 *
 * In order to enable streaming SSR, individual page and layouts components
 * must suspend. We can't just have one big suspense that we handle
 * (or else we can't isolate the first chunk). That being said, we
 * don't want network waterfalls. So we need to send the request for everything all
 * at once and then wrap the children in the necssary context.
 *
 * Children will be responsible for suspending while they wait for the query.
 */
export function Router({
	cache,
	manifest,
	client,
}: {
	cache: Cache
	manifest: RouterManifest
	client: HoudiniClient
}) {
	// the current route is just a string in state.
	const [current, setCurrent] = React.useState(() => {
		return window.location.pathname
	})

	// find the matching route
	const [match, matchVariables] = find_match(manifest, current)
}
