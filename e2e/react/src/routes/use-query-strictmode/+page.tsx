import { StrictMode, Suspense } from 'react'
import { graphql, useMutation, useQuery } from '$houdini'

// The same sibling query/mutation shape as use-query-reactivity, but wrapped in
// StrictMode. In development React double-invokes effects (mount, simulated unmount,
// mount again), so any teardown wired to "unmount" runs while the component is still
// alive: the store has to survive that cycle with its cache subscription intact. The
// production build renders this identically (StrictMode is a no-op there); the dev
// server is where the test bites.
function UserName() {
	const data = useQuery(
		graphql(`
			query UseQueryStrictModeUser($snapshot: String!, $id: ID!) {
				user(id: $id, snapshot: $snapshot) {
					id
					name
				}
			}
		`),
		{ snapshot: 'use-query-strictmode', id: '1' }
	)

	return <div id="name">{data.user.name}</div>
}

// sibling mutation, isolated from the query component (see use-query-reactivity)
function UpdateButton() {
	const [update] = useMutation(
		graphql(`
			mutation UseQueryStrictModeUpdate($snapshot: String!, $id: ID!, $name: String!) {
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
					variables: { snapshot: 'use-query-strictmode', id: '1', name: 'Updated Name' },
				})
			}
		>
			update
		</button>
	)
}

export default function () {
	return (
		<StrictMode>
			<Suspense fallback={<div id="fallback">loading</div>}>
				<UserName />
			</Suspense>

			<UpdateButton />
		</StrictMode>
	)
}
