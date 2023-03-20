import { graphql } from '$houdini'
import { cache } from '$houdini'
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
	const [data] = useQuery(
		graphql(`
			query MyQuery {
				hello
			}
		`)
	)

	return <div>{data.hello}</div>
}

function useQuery(artifact, variables = null) {
	const [storeValue, observer] = useLiveDocument(artifact, variables)

	// if we don't have any data in the observer yet, see if we can load from the cache
	// if we do have the data in the cache then we want to use that value as the result of
	// this hook so we need to store it locally
	let localData = null
	if (!storeValue.data) {
		const { data } = cache.read({
			query: { artifact },
		})

		// if we can't load from the cache then we have to suspend until we can
		// NOTE: this is the bit that prevents infinite suspense loops. By suspending until
		// send() is finished, data won't be null next time we come back here
		if (data === null) {
			throw observer.send({ variables })
		}

		// use the cache version for the first non-suspense'd mount of this hook
		localData = data
	}

	// if the store is fetching then we need to suspend until the
	// store is ready for us
	if (storeValue.fetching && observer.pendingPromise) {
		throw observer.pendingPromise
	}

	// by preferring the store value over the local instance we make sure that any
	// updates that show up do not get blocked by the cache read we did when the component
	// mounts
	return [storeValue.data ?? localData]
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
	const { current: observer } = React.useRef(client.observe({ artifact, fetching: true }))

	// get a safe reference to the cache
	const storeValue = React.useSyncExternalStore(
		observer.subscribe.bind(observer),
		() => observer.state
	)

	return [storeValue, observer]
}
