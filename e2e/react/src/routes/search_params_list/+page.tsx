import { Link, useRoute } from '$houdini'

import type { PageProps, PageRoute } from './$types'

// two fixed DateTimes for the custom-scalar List case
const D1 = new Date('2024-01-01T00:00:00.000Z')
const D2 = new Date('2024-06-01T00:00:00.000Z')

export default function ({ SearchListUsers }: PageProps) {
	const { usersList } = SearchListUsers
	const { search } = useRoute<PageRoute>()
	return (
		<div>
			<div className="flex flex-row gap-12">
				<Link id="tags-multi" to="/search_params_list" search={{ tags: ['a', 'b'] }}>
					multi
				</Link>
				<Link id="tags-single" to="/search_params_list" search={{ tags: ['solo'] }}>
					single
				</Link>
				<Link id="dates-link" to="/search_params_list" search={{ dates: [D1, D2] }}>
					dates
				</Link>
			</div>
			<div id="result">{usersList.map((user) => user.name).join(', ')}</div>
			{/* a String List search param: repeated keys -> array (single value stays an array) */}
			<div id="tags">{JSON.stringify(search.tags ?? null)}</div>
			{/* a DateTime List search param: each element unmarshaled to a Date */}
			<div id="dates-types">
				{(search.dates ?? []).map((d) => (d instanceof Date ? 'Date' : typeof d)).join(',')}
			</div>
			<div id="dates-isos">
				{(search.dates ?? []).map((d) => (d instanceof Date ? d.toISOString() : '')).join(',')}
			</div>
		</div>
	)
}
