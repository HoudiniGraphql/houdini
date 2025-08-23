import { CachePolicy } from '$houdini'

import type { PageProps } from './$types'

export default function ({
	BidirectionalPaginationQuery,
	BidirectionalPaginationQuery$handle,
}: PageProps) {
	const handle = BidirectionalPaginationQuery$handle

	return (
		<>
			<div id="result">
				{BidirectionalPaginationQuery.usersConnection.edges
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
