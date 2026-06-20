import { Link, useLocation } from '$houdini'

import type { PageProps } from './$types'

export default function ({ SearchParamsUsers }: PageProps) {
	const { usersList } = SearchParamsUsers
	// the parsed query string: declared params (offset/limit) are coerced to numbers,
	// any other key (e.g. tab) passes through as a raw string
	const { search } = useLocation()
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
			</div>
			<div id="result">{usersList.map((user) => user.name).join(', ')}</div>
			<div id="search">{JSON.stringify(search)}</div>
			<div id="offset-type">{typeof search.offset}</div>
		</div>
	)
}
