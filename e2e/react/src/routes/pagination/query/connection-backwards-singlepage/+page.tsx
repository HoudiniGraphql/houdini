import type { PageProps } from './$types'

export default function ({
	BackwardsCursorSinglePagePaginationQuery,
	BackwardsCursorSinglePagePaginationQuery$handle,
}: PageProps) {
	const handle = BackwardsCursorSinglePagePaginationQuery$handle

	return (
		<>
			<div id="result">
				{BackwardsCursorSinglePagePaginationQuery.usersConnectionBackwardOnly.edges
					.map(({ node }) => node?.name)
					.join(', ')}
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
