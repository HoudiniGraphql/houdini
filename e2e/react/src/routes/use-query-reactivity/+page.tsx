import { Suspense, useState } from 'react'
import { graphql, useMutation, useQuery } from '$houdini'

// Sibling A: renders a user's name via useQuery inside Suspense. This component owns no
// state of its own, so the only thing that can re-render it after the initial load is a
// notification from the document store's subscription (or its id prop changing, which
// makes it re-suspend with new variables).
function UserName({ id }: { id: string }) {
	const data = useQuery(
		graphql(`
			query UseQueryReactivityUser($snapshot: String!, $id: ID!) {
				user(id: $id, snapshot: $snapshot) {
					id
					name
				}
			}
		`),
		{ snapshot: 'use-query-reactivity', id }
	)

	return <div id="name">{data.user.name}</div>
}

// Sibling B: fires a mutation that updates a user record in the cache. It is a sibling of
// UserName (not a parent/child) and holds no state tied to the click, so clicking must
// not re-render UserName for any reason other than the cache write propagating through
// the store subscription. That isolation is what makes this a real test of reactivity:
// if the subscription is muted, UserName never updates.
function UpdateButton({ buttonId, id, name }: { buttonId: string; id: string; name: string }) {
	const [update] = useMutation(
		graphql(`
			mutation UseQueryReactivityUpdate($snapshot: String!, $id: ID!, $name: String!) {
				updateUser(id: $id, snapshot: $snapshot, name: $name) {
					id
					name
				}
			}
		`)
	)

	return (
		<button
			id={buttonId}
			onClick={() =>
				update({
					variables: { snapshot: 'use-query-reactivity', id, name },
				})
			}
		>
			{buttonId}
		</button>
	)
}

export default function () {
	// which user the query renders. switching makes UserName re-suspend with new variables
	const [userID, setUserID] = useState('1')

	return (
		<>
			<Suspense fallback={<div id="fallback">loading</div>}>
				<UserName id={userID} />
			</Suspense>

			<UpdateButton buttonId="update-1" id="1" name="Updated One" />
			<UpdateButton buttonId="update-2" id="2" name="Updated Two" />
			<button id="switch" onClick={() => setUserID('2')}>
				switch
			</button>
		</>
	)
}
