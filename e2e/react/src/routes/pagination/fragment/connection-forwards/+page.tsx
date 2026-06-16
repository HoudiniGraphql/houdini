import { graphql, useFragmentHandle } from '$houdini'
import type { PageProps } from './$types'

const fragment = graphql(`
	fragment FragmentCursorForwardsFragment on User {
		usersConnectionSnapshot(snapshot: "pagination-fragment-cursor-forwards", first: 2) @paginate {
			edges {
				node {
					name
				}
			}
			pageInfo {
				hasNextPage
				hasPreviousPage
				startCursor
				endCursor
			}
		}
	}
`)

export default function ({ FragmentCursorForwardsQuery }: PageProps) {
	const handle = useFragmentHandle(FragmentCursorForwardsQuery.user, fragment)

	return (
		<>
			<div id="result">
				{handle.data?.usersConnectionSnapshot.edges.map(({ node }) => node?.name).join(', ')}
			</div>

			<div id="pageInfo">{JSON.stringify(handle.pageInfo)}</div>

			<button id="next" onClick={() => handle.loadNext()}>
				next
			</button>
		</>
	)
}
