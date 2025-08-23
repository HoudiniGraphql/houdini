import { CachePolicy } from '$houdini'

import type { PageProps } from './$types'

export default function ({
	OffsetPaginationSinglePageQuery,
	OffsetPaginationSinglePageQuery$handle,
}: PageProps) {
	const handle = OffsetPaginationSinglePageQuery$handle

	return (
		<>
			<div id="result">
				{OffsetPaginationSinglePageQuery.usersList.map((user) => user?.name).join(', ')}
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
