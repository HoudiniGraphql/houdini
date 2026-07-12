import { Suspense } from 'react'
import { graphql, useQuery } from '$houdini'

// A useQuery whose fetch errors (the api throws "User not found" for id 999). The error
// must reach the route's error boundary — not hang the suspense, loop refetches, or
// commit the component with null data.
function BrokenUser() {
	const data = useQuery(
		graphql(`
			query UseQueryErrorUser($snapshot: String!) {
				user(id: "999", snapshot: $snapshot) {
					id
					name
				}
			}
		`),
		{ snapshot: 'use-query-error' }
	)

	return <div id="name">{data.user.name}</div>
}

export default function () {
	return (
		<Suspense fallback={<div id="fallback">loading</div>}>
			<BrokenUser />
		</Suspense>
	)
}
