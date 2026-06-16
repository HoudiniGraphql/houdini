import { graphql, useFragmentHandle } from '$houdini'
import type { PageProps } from './$types'

const fragment = graphql(`
	fragment UserConnectionSinglePageFragment on User {
		usersConnectionSnapshot(snapshot: "pagination-fragment-bidirectional-singlepage", first: 2) @paginate(mode: SinglePage) {
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

export default function ({ FragmentSinglePageQuery }: PageProps) {
	const handle = useFragmentHandle(FragmentSinglePageQuery.user, fragment)

	return (
		<>
			<div id="result">
				{handle.data?.usersConnectionSnapshot.edges.map(({ node }) => node?.name).join(', ')}
			</div>

			<div id="pageInfo">{JSON.stringify(handle.pageInfo)}</div>

			<button id="previous" onClick={() => handle.loadPrevious()}>
				previous
			</button>

			<button id="next" onClick={() => handle.loadNext()}>
				next
			</button>
		</>
	)
}
