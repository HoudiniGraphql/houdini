import { CachePolicy } from '$houdini'

import type { PageProps } from './$types'

export default function ({
	OffsetVariablePaginationQuery,
	OffsetVariablePaginationQuery$handle,
}: PageProps) {
	const handle = OffsetVariablePaginationQuery$handle

	return (
		<>
			<div id="result">
				{OffsetVariablePaginationQuery.usersList.map((user) => user?.name).join(', ')}
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
