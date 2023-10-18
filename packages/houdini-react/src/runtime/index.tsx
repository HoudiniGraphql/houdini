import type { Cache } from '$houdini/runtime/cache/cache'

import client from './client'
import manifest from './manifest'
import { Router as RouterImpl, RouterCache, RouterContextProvider } from './routing'

export * from './hooks'
export { router_cache } from './routing'

export function Router({
	cache,
	initialURL,
	artifact_cache,
	component_cache,
	data_cache,
	ssr_signals,
	last_variables,
	session,
	assetPrefix,
	injectToStream,
}: {
	initialURL: string
	cache: Cache
	session?: App.Session
	assetPrefix: string
	injectToStream?: (chunk: string) => void
} & RouterCache) {
	return (
		<RouterContextProvider
			client={client()}
			cache={cache}
			artifact_cache={artifact_cache}
			component_cache={component_cache}
			data_cache={data_cache}
			ssr_signals={ssr_signals}
			last_variables={last_variables}
			session={session}
		>
			<RouterImpl
				initialURL={initialURL}
				manifest={manifest}
				assetPrefix={assetPrefix}
				injectToStream={injectToStream}
			/>
		</RouterContextProvider>
	)
}
