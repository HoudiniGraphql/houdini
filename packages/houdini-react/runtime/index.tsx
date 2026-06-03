import type { GraphQLObject } from 'houdini/runtime'
import type { Cache } from 'houdini/runtime/cache'

import client from './client.js'
import manifest from './manifest.js'
import { Router as RouterImpl, type RouterCache, RouterContextProvider } from './routing/index.js'

export * from './hooks/index.js'
export { router_cache, useSession, useLocation, useRoute } from './routing/index.js'

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
	initialVariables: GraphQLObject
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
