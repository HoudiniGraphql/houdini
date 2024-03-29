import { CachePolicy } from '$houdini'

import type { PageProps } from './$types'

export default function ({ OffsetPaginationQuery, OffsetPaginationQuery$handle }: PageProps) {
	const handle = OffsetPaginationQuery$handle

	return (
		<>
			<div id="result">
				{OffsetPaginationQuery.usersList.map((user) => user?.name).join(', ')}
			</div>

			<button id="next" onClick={() => handle.loadNext()}>
				next
			</button>

			<button id="refetch" onClick={() => handle.fetch({ policy: CachePolicy.NetworkOnly })}>
				refetch
			</button>
		</>
	)
}
