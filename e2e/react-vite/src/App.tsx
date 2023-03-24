import { useQueryHandle, useFragment, graphql, HoudiniProvider, type UserInfo } from '$houdini'
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
	const [localVariables, setLocalVariables] = React.useState({ id: '1' })

	const { data, refetch, loading, variables } = useQueryHandle(
		graphql(`
			query MyQuery($id: ID!) {
				user(id: $id, snapshot: "react-vite-e2e") {
					id
					...UserInfo
				}
			}
		`),
		localVariables
	)

	return (
		<>
			<div>
				<button onClick={() => setLocalVariables({ id: '2' })}>
					fetch user 2 (suspend)
				</button>
				<button onClick={() => setLocalVariables({ id: '3' })}>
					fetch user 3 (suspend)
				</button>
			</div>
			<div>
				<button onClick={() => refetch({ variables: { id: '2' } })}>fetch user 2</button>
				<button onClick={() => refetch({ variables: { id: '3' } })}>fetch user 3</button>
				{loading && 'pending fetch'}
			</div>

			<div>{JSON.stringify(variables)}</div>
			<Fragment user={data.user} />
		</>
	)
}

function Fragment({ user }: { user: UserInfo }) {
	const data = useFragment(
		user,
		graphql(`
			fragment UserInfo on User {
				name
			}
		`)
	)

	console.log('fragment data', data)

	return <div>{data.name}</div>
}
