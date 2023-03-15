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

function useQuery(artifact) {
	// hold onto an observer we'll use
	const observer = React.useRef(client.observe({ artifact }))

	// get a safe reference to the cache
	const storeValue = React.useSyncExternalStore(
		observer.current.subscribe.bind(observer.current),
		() => observer.current.state
	)

	//

	return storeValue
}

graphql(`
	query MyQuery {
		hello
	}
`)
