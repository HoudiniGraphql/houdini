import { isPending } from '$houdini'

import type { PageProps } from './$types'

// A paginated @loading query whose page reads its handle during render: the loading
// frame's handle must survive extractPageInfo over loading-marker data, and the resolved
// handle must still paginate afterwards.
export default function ({
	DelayedLoadingPaginationQuery,
	DelayedLoadingPaginationQuery$handle,
}: PageProps) {
	const handle = DelayedLoadingPaginationQuery$handle
	const edges = DelayedLoadingPaginationQuery.usersConnection.edges

	return (
		<>
			<div id="result">
				{edges
					.map(({ node }) => (isPending(node?.name) ? 'loading' : node?.name))
					.join(', ')}
			</div>
			<div id="page-info">{JSON.stringify(handle.pageInfo)}</div>
			<button id="next" onClick={() => handle.loadNext()}>
				next
			</button>
		</>
	)
}
