import type { GraphQLObject } from 'houdini/runtime'
import type { Cache } from 'houdini/runtime/cache'

import client from './client.js'
import manifest from './manifest.js'
import {
	Router as RouterImpl,
	type RouterCache,
	type FormResult,
	RouterContextProvider,
} from './routing/index.js'

export * from './hooks/index.js'
export {
	router_cache,
	useCache,
	useSession,
	useRoute,
	useNavigation,
	notFound,
	unauthorized,
	forbidden,
	httpError,
	redirect,
	isRoutingError,
	isApiError,
	RoutingError,
	RedirectError,
} from './routing/index.js'
export type { GenericRoute } from './routing/index.js'
export * from './Link.js'
export { createMock } from './mock.js'

export function Router({
	cache,
	initialURL,
	artifact_cache,
	component_cache,
	data_cache,
	ssr_signals,
	last_variables,
	session,
	formResult,
	formToken,
	assetPrefix,
	injectToStream,
}: {
	initialURL: string
	initialVariables: GraphQLObject
	cache: Cache
	session?: App.Session
	formResult?: FormResult | null
	formToken?: string | null
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
			formResult={formResult}
			formToken={formToken}
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
