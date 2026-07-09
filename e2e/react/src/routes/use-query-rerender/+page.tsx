import React, { Suspense } from 'react'
import { graphql, useQuery } from '$houdini'

// a parent that re-renders while its child is suspended on useQuery. the child must
// stay suspended (fallback visible) until the data lands — a re-render mid-flight
// must not commit the child with empty data.
function UseQueryResult() {
	const data = useQuery(
		graphql(`
			query UseQueryRerenderTest($snapshot: String!) {
				user(id: "1", snapshot: $snapshot, delay: 2000) {
					id
					name
				}
			}
		`),
		{ snapshot: 'use-query-rerender' }
	)

	return <div id="result">{data.user?.name ?? 'MISSING'}</div>
}

export default function () {
	const [count, setCount] = React.useState(0)

	return (
		<>
			<button id="rerender" onClick={() => setCount(count + 1)}>
				rerender {count}
			</button>

			<Suspense fallback={<div id="fallback">loading</div>}>
				<UseQueryResult />
			</Suspense>
		</>
	)
}
