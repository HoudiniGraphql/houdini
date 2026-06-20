import { Link } from '$houdini'

import type { PageProps } from './$types'

export default function ({ SearchParamsUsers }: PageProps) {
	const { usersList } = SearchParamsUsers
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
			</div>
			<div id="result">{usersList.map((user) => user.name).join(', ')}</div>
		</div>
	)
}
