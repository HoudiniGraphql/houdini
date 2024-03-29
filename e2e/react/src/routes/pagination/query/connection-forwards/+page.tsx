import { CachePolicy } from '$houdini'

import type { PageProps } from './$types'

export default function ({
	ForwardsCursorPaginationQuery,
	ForwardsCursorPaginationQuery$handle,
}: PageProps) {
	const handle = ForwardsCursorPaginationQuery$handle

	return (
		<>
			<div id="result">
				{ForwardsCursorPaginationQuery.usersConnection.edges
					.map(({ node }) => node?.name)
					.join(', ')}
			</div>

			<div id="pageInfo">{JSON.stringify(handle.pageInfo)}</div>

			<button id="next" onClick={() => handle.loadNext()}>
				next
			</button>

			<button id="refetch" onClick={() => handle.fetch({ policy: CachePolicy.NetworkOnly })}>
				refetch
			</button>
		</>
	)
}
