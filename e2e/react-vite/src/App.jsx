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
	const data = useQuery(MyQuery)
	return <div>{JSON.stringify(data)}</div>
}

function useQuery(artifact, variables = null) {
	// hold onto an observer we'll use
	const observer = React.useRef(client.observe({ artifact, fetching: true }))

	// get a safe reference to the cache
	const storeValue = React.useSyncExternalStore(
		observer.current.subscribe.bind(observer.current),
		() => observer.current.state
	)

	React.useEffect(() => {
		observer.current.send({ variables })
	}, [variables])

	// pass the store onto the user
	return storeValue
}

graphql(`
	query MyQuery {
		hello
	}
`)
