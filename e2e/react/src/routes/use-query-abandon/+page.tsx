import { Suspense } from 'react'
import { graphql, useMutation, useQuery } from '$houdini'

// A slow useQuery so the test can navigate away while the component is still suspended
// (abandoning the in-flight fetch) and come back after it resolves. The returning mount
// must pick the resolved suspense entry (and its store) back up: data renders without a
// second fetch and cache writes still propagate.
function UserName() {
	const data = useQuery(
		graphql(`
			query UseQueryAbandonUser($snapshot: String!, $id: ID!, $delay: Int) {
				user(id: $id, snapshot: $snapshot, delay: $delay) {
					id
					name
				}
			}
		`),
		{ snapshot: 'use-query-abandon', id: '1', delay: 2000 }
	)

	return <div id="name">{data.user.name}</div>
}

// sibling mutation, isolated from the query component (see use-query-reactivity)
function UpdateButton() {
	const [update] = useMutation(
		graphql(`
			mutation UseQueryAbandonUpdate($snapshot: String!, $id: ID!, $name: String!) {
				updateUser(id: $id, snapshot: $snapshot, name: $name) {
					id
					name
				}
			}
		`)
	)

	return (
		<button
			id="update"
			onClick={() =>
				update({
					variables: { snapshot: 'use-query-abandon', id: '1', name: 'Updated Name' },
				})
			}
		>
			update
		</button>
	)
}

export default function () {
	return (
		<>
			<Suspense fallback={<div id="fallback">loading</div>}>
				<UserName />
			</Suspense>

			<UpdateButton />
		</>
	)
}
