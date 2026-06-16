import { CachePolicy } from '$houdini'

import type { PageProps } from './$types'

export default function ({
	BidirectionalCursorSinglePagePaginationQuery,
	BidirectionalCursorSinglePagePaginationQuery$handle,
}: PageProps) {
	const handle = BidirectionalCursorSinglePagePaginationQuery$handle

	return (
		<>
			<div id="result">
				{BidirectionalCursorSinglePagePaginationQuery.user?.usersConnectionSnapshot.edges
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

			<button id="refetch" onClick={() => handle.fetch({ policy: CachePolicy.NetworkOnly })}>
				refetch
			</button>
		</>
	)
}
