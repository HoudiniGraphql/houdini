import { CachePolicy } from '$houdini'

import type { PageProps } from './$types'

export default function ({
	BackwardsCursorPaginationQuery,
	BackwardsCursorPaginationQuery$handle,
}: PageProps) {
	const handle = BackwardsCursorPaginationQuery$handle

	return (
		<>
			<div id="result">
				{BackwardsCursorPaginationQuery.usersConnection.edges
					.map(({ node }) => node?.name)
					.join(', ')}
			</div>

			<div id="pageInfo">{JSON.stringify(handle.pageInfo)}</div>

			<button id="previous" onClick={() => handle.loadPrevious()}>
				previous
			</button>

			<button id="refetch" onClick={() => handle.fetch({ policy: CachePolicy.NetworkOnly })}>
				refetch
			</button>
		</>
	)
}
