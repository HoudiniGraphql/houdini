import { graphql, isPending, useFragmentHandle } from '$houdini'

import type { PageProps } from './$types'

const fragment = graphql(`
	fragment LoadingFragmentList on User {
		usersConnectionSnapshot(snapshot: "loading-paginated-fragment", first: 2) @paginate {
			edges {
				node {
					name
				}
			}
			pageInfo {
				hasNextPage
				endCursor
			}
		}
	}
`)

// Rendered as a child so it mounts *during* the parent query's @loading frame
// (no if-guard). This is the exact scenario from issue #1408.
function FriendsList({ user }: { user: any }) {
	const handle = useFragmentHandle(user, fragment)

	const edges = handle.data?.usersConnectionSnapshot?.edges
	const names = Array.isArray(edges)
		? edges
				.map(({ node }) => node?.name)
				.filter((name) => typeof name === 'string')
				.join(', ')
		: ''

	return (
		<>
			<div id="result">{names}</div>
			<div id="pageInfo">{JSON.stringify(handle.pageInfo)}</div>
			<button id="next" onClick={() => handle.loadNext()}>
				next
			</button>
		</>
	)
}

export default function ({ LoadingFragmentQuery }: PageProps) {
	const user = LoadingFragmentQuery.user

	return (
		<>
			<div id="name">{isPending(user.name) ? 'loading' : user.name}</div>
			<FriendsList user={user} />
		</>
	)
}
