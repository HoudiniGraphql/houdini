import { Link, useRoute } from '$houdini'

import type { PageProps, PageRoute } from './$types'

// a fixed DateTime used by both the Link and goto cases so the test can assert an exact
// round-trip (marshal -> url -> unmarshal)
const AFTER = new Date('2024-01-01T00:00:00.000Z')

export default function ({ SearchParamsUsers }: PageProps) {
	const { usersList } = SearchParamsUsers
	// the parsed query string: declared params (offset/limit) are coerced to numbers, a
	// declared custom scalar (after: DateTime) is unmarshaled to a Date, and any other key
	// (e.g. tab) passes through as a raw string
	const { search, goto } = useRoute<PageRoute>()


	return (
		<div>
			<div className="flex flex-row gap-12">
				<Link id="default-link" to="/search_params">
					default
				</Link>
				<Link id="offset-link" to="/search_params" search={{ offset: 2 }}>
					offset 2
				</Link>
				<Link id="limit-link" to="/search_params" search={{ limit: 2 }}>
					limit 2
				</Link>
				<Link id="ui-link" to="/search_params" search={{ offset: 2, tab: 'reviews' }}>
					offset + tab
				</Link>
				<Link id="date-link" to="/search_params" search={{ after: AFTER }}>
					after (Link)
				</Link>
				<button id="goto-date" onClick={() => goto({ to: '/search_params', search: { after: AFTER } })}>
					after (goto)
				</button>
			</div>
			<div id="result">{usersList.map((user) => user.name).join(', ')}</div>
			<div id="search">{JSON.stringify(search)}</div>
			<div id="offset-type">{typeof search.offset}</div>
			<div id="after-type">{search.after instanceof Date ? 'Date' : typeof search.after}</div>
			<div id="after-iso">{search.after instanceof Date ? search.after.toISOString() : ''}</div>
		</div>
	)
}
