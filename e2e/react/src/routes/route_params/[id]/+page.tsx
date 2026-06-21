import { useRoute } from '$houdini'

import type { PageProps, PageRoute } from './$types'

export default function ({ RouteParamsUserInfo }: PageProps) {
	const { params } = useRoute<PageRoute>()

	const { user } = RouteParamsUserInfo
	return (
		<div>
			<div id="result">
				{params.id}:{user.name}
			</div>
		</div>
	)
}
