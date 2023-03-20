import { useQuery, graphql, HoudiniProvider } from '$houdini'
import * as React from 'react'

import client from './client'

export default function App() {
	return (
		<HoudiniProvider client={client}>
			<React.Suspense fallback="loading...">
				<Child />
			</React.Suspense>
		</HoudiniProvider>
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
