import { useRoute } from '$houdini'

import type { PageProps, PageRoute } from './$types'

// a custom-scalar (DateTime) route param: the path segment carries the marshaled value
// and useRoute().location.params.day comes back as a Date.
export default function ({ RouteParamDate }: PageProps) {
	const { usersList } = RouteParamDate
	const { location } = useRoute<PageRoute>()
	return (
		<div>
			<div id="result">{usersList.map((user) => user.name).join(', ')}</div>
			<div id="day-type">{location.params.day instanceof Date ? 'Date' : typeof location.params.day}</div>
			<div id="day-iso">
				{location.params.day instanceof Date ? location.params.day.toISOString() : ''}
			</div>
		</div>
	)
}
