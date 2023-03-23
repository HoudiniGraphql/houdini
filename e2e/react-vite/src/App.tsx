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
	const { data, refetch, variables } = useQueryHandle(
		graphql(`
			query MyQuery($id: ID!) {
				user(id: $id, snapshot: "react-vite-e2e") {
					id
					...UserInfo
				}
			}
		`),
		{
			id: '1',
		}
	)

	return (
		<>
			<button
				onClick={() =>
					refetch({
						variables: { id: '2' },
					})
				}
			>
				fetch user 2
			</button>
			<button
				onClick={() =>
					refetch({
						variables: { id: '3' },
					})
				}
			>
				fetch user 3
			</button>

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
