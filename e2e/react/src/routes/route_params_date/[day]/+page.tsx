import { useRoute } from '$houdini'

import type { PageProps, PageRoute } from './$types'

// a custom-scalar (DateTime) route param: the path segment carries the marshaled value
// and useRoute().params.day comes back as a Date.
export default function ({ RouteParamDate }: PageProps) {
	const { usersList } = RouteParamDate
	const { params } = useRoute<PageRoute>()
	return (
		<div>
			<div id="result">{usersList.map((user) => user.name).join(', ')}</div>
			<div id="day-type">{params.day instanceof Date ? 'Date' : typeof params.day}</div>
			<div id="day-iso">{params.day instanceof Date ? params.day.toISOString() : ''}</div>
		</div>
	)
}
