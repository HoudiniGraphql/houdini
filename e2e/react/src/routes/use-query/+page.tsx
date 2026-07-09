import React, { Suspense } from 'react'
import { graphql, useQuery } from '$houdini'

// useQuery issues a query imperatively from inside a component (rather than receiving it
// as a route prop) and suspends until the data is available. The result is the data
// directly, and changing the variables re-runs the query. This pins that contract e2e.
function UseQueryResult({ limit }: { limit: number }) {
	const data = useQuery(
		graphql(`
			query UseQueryTest($snapshot: String!, $limit: Int!) {
				usersList(snapshot: $snapshot, limit: $limit) {
					id
					name
				}
			}
		`),
		{ snapshot: 'use-query', limit }
	)

	return <div id="result">{data.usersList.map((user) => user.name).join(', ')}</div>
}

export default function () {
	const [limit, setLimit] = React.useState(2)

	return (
		<>
			<Suspense fallback={<div id="fallback">loading</div>}>
				<UseQueryResult limit={limit} />
			</Suspense>

			<button id="more" onClick={() => setLimit(4)}>
				more
			</button>
		</>
	)
}
