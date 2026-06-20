import { useRoute } from '$houdini'

import type { PageProps, PageRoute } from './$types'

export default function ({ RouteParamsUserInfo }: PageProps) {
	const { location } = useRoute<PageRoute>()

	const { user } = RouteParamsUserInfo
	return (
		<div>
			<div id="result">
				{location.params.id}:{user.name}
			</div>
		</div>
	)
}
