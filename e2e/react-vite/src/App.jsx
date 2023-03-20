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
	const [storeValue, observer] = useLiveDocument(artifact, variables)

	// when we first render we need to suspend and fetch
	const count = React.useRef(0)
	if (count.current === 0) {
		throw new Promise((resolve, reject) => {
			console.log('suspending')
			observer.send({ variables }).then(() => {
				count.current = 1

				resolve()
			})
		})
	}

	// if the store is fetching then we need to suspend until the
	// store is ready for us
	if (storeValue.fetching && observer.pendingPromise) {
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
	const { current: observer } = React.useRef(client.observe({ artifact, fetching: true }))

	// get a safe reference to the cache
	const storeValue = React.useSyncExternalStore(
		observer.subscribe.bind(observer),
		() => observer.state
	)

	return [storeValue, observer]
}

function unwrapPromise() {
	let resolve, reject
	const promise = new Promise((res, rej) => {
		resolve = res
		reject = rej
	})

	return {
		resolve,
		reject,
		then,
	}
}
