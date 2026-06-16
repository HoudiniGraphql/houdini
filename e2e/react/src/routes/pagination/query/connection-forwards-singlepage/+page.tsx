import type { PageProps } from './$types'

export default function ({
	ForwardsCursorSinglePagePaginationQuery,
	ForwardsCursorSinglePagePaginationQuery$handle,
}: PageProps) {
	const handle = ForwardsCursorSinglePagePaginationQuery$handle

	return (
		<>
			<div id="result">
				{ForwardsCursorSinglePagePaginationQuery.usersConnectionForwardOnly.edges
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
