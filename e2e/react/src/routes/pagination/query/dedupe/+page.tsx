import { PageProps } from './$types'

export default function ({ DedupePaginationFetch, DedupePaginationFetch$handle }: PageProps) {
	return (
		<div>
			<div id="result">
				{DedupePaginationFetch.usersConnection.edges
					.map(({ node }) => node?.name)
					.join(', ')}
			</div>

			<div id="pageInfo">
				{JSON.stringify(DedupePaginationFetch.usersConnection.pageInfo)}
			</div>

			<button id="next" onClick={() => DedupePaginationFetch$handle.loadNext()}>
				next
			</button>
		</div>
	)
}
