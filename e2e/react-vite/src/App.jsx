import { graphql } from '$houdini'
import MyQuery from '$houdini/artifacts/MyQuery'
import * as React from 'react'

import client from './client'

export default function App() {
	return (
		<React.Suspense fallback="loading...">
			<Child />
		</React.Suspense>
	)
}

function Child() {
	const { data } = useQuerySuspense(
		graphql(`
			query MyQuery {
				hello
			}
		`)
	)
	return <div>{data?.hello}</div>
}

function useQuerySuspense(artifact, variables = null) {
	const mount = React.useRef(null)
	const [storeValue, observer] = useLiveDocument(artifact, variables)

	// if the store is fetching then we need to suspend until the
	// store is ready for us
	if (storeValue.fetching) {
		throw observer.pendingPromise
	}

	return storeValue
}

function useQuery(artifact, variables = null) {
	const [storeValue] = useLiveDocument(artifact, variables)
	return storeValue
}

function useLiveDocument(artifact, variables) {
	// grab the document store for the artifact
	const [storeValue, observer] = useDocumentStore(artifact)

	// whenever the variables change, we need to retrigger the query
	React.useEffect(() => {
		observer.send({ variables })
	}, [variables])

	return [storeValue, observer]
}

function useDocumentStore(artifact) {
	// hold onto an observer we'll use
	const { current: observer } = React.useRef(client.observe({ artifact }))

	// get a safe reference to the cache
	const storeValue = React.useSyncExternalStore(
		observer.subscribe.bind(observer),
		() => observer.state
	)

	return [storeValue, observer]
}
