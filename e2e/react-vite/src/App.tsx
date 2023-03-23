import {
	useQuery,
	useFragment,
	graphql,
	HoudiniProvider,
	type UserInfo,
	useMutation,
} from '$houdini'
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
	const data = useQuery(
		graphql(`
			query MyQuery {
				user(id: "1", snapshot: "react-vite-e2e") {
					...UserInfo
				}
			}
		`)
	)

	return <Fragment user={data.user} />
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

	return <div>{data.name}</div>
}
