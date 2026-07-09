import { Suspense } from 'react'
import { graphql, useQuery } from '$houdini'

// Rendered server-side, this useQuery resolves during streaming and its result lands in
// the raw HTML. The suspense state that carries it must be scoped to the request: another
// request for the same page must render from its OWN fetch, never from a previous
// request's resolved data (which, for a session-dependent query, would be another user's
// data).
function UserName() {
	const data = useQuery(
		graphql(`
			query UseQuerySsrUser($snapshot: String!, $id: ID!) {
				user(id: $id, snapshot: $snapshot) {
					id
					name
				}
			}
		`),
		{ snapshot: 'use-query-ssr', id: '1' }
	)

	return <div id="name">{data.user.name}</div>
}

export default function () {
	return (
		<Suspense fallback={<div id="fallback">loading</div>}>
			<UserName />
		</Suspense>
	)
}
