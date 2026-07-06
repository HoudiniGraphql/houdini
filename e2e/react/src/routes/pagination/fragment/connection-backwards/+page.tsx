import { graphql, useFragmentHandle } from '$houdini'
import type { PageProps } from './$types'

const fragment = graphql(`
	fragment FragmentCursorBackwardsFragment on User {
		usersConnectionSnapshot(snapshot: "pagination-fragment-cursor-backwards", last: 2) @paginate {
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

export default function ({ FragmentCursorBackwardsQuery }: PageProps) {
	const handle = useFragmentHandle(FragmentCursorBackwardsQuery.user, fragment)

	return (
		<>
			<div id="result">
				{handle.data?.usersConnectionSnapshot.edges.map(({ node }) => node?.name).join(', ')}
			</div>

			<div id="pageInfo">{JSON.stringify(handle.pageInfo)}</div>

			<button id="previous" onClick={() => handle.loadPrevious()}>
				previous
			</button>
		</>
	)
}
