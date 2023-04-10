import { useQuery, useFragment, graphql, HoudiniProvider, type UserInfo } from '$houdini'
import * as React from 'react'

import client from './client'

export default function App() {
	return (
		<HoudiniProvider client={client}>
			<React.Suspense fallback="loading...">
				<Query />
			</React.Suspense>
		</HoudiniProvider>
	)
}

function Query() {
	const [variables, setVariables] = React.useState({ id: '1' })
	const [pending, start] = React.useTransition()

	const data = useQuery(
		graphql(`
			query MyQuery($id: ID!) {
				user(id: $id, snapshot: "react-vite-e2e") {
					id
					...UserInfo
				}
			}
		`),
		variables
	)

	return (
		<>
			<div>
				<button
					onClick={() =>
						start(() => {
							setVariables({ id: '2' })
						})
					}
				>
					fetch user 2 (no suspense)
				</button>
				<button onClick={() => setVariables({ id: '3' })}>fetch user 3 (suspend)</button>
				{pending && 'pending'}
			</div>

			<Fragment user={data.user} />
		</>
	)
}

function Fragment({ user }: { user: UserInfo }) {
	const data = useFragment(
		user,
		graphql(`
			fragment UserInfo on User {
				id
				name
			}
		`)
	)

	return (
		<div>
			{data.id}: {data.name}
		</div>
	)
}
