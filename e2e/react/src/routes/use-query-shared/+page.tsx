import { Suspense, useState } from 'react'
import { graphql, useMutation, useQuery } from '$houdini'

// Two components render the SAME query with the SAME variables, so they share one
// suspense identifier (and, through it, one document store). Unmounting one must not
// tear down the store the other is still using: the survivor has to keep reflecting
// cache writes.
function UserName({ elementId }: { elementId: string }) {
	const data = useQuery(
		graphql(`
			query UseQuerySharedUser($snapshot: String!, $id: ID!) {
				user(id: $id, snapshot: $snapshot) {
					id
					name
				}
			}
		`),
		{ snapshot: 'use-query-shared', id: '1' }
	)

	return <div id={elementId}>{data.user.name}</div>
}

// sibling mutation, isolated from the query components (see use-query-reactivity)
function UpdateButton() {
	const [update] = useMutation(
		graphql(`
			mutation UseQuerySharedUpdate($snapshot: String!, $id: ID!, $name: String!) {
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
					variables: { snapshot: 'use-query-shared', id: '1', name: 'Updated Name' },
				})
			}
		>
			update
		</button>
	)
}

export default function () {
	const [showFirst, setShowFirst] = useState(true)

	return (
		<>
			<Suspense fallback={<div id="fallback">loading</div>}>
				{showFirst && <UserName elementId="name-a" />}
				<UserName elementId="name-b" />
			</Suspense>

			<UpdateButton />
			<button id="unmount-a" onClick={() => setShowFirst(false)}>
				unmount a
			</button>
		</>
	)
}
