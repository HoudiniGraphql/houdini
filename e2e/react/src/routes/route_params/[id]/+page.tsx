import { useRoute } from '$houdini'

import type { PageProps } from './$types'

export default function ({ RouteParamsUserInfo }: PageProps) {
	const route = useRoute<PageProps>()

	const { user } = RouteParamsUserInfo
	return (
		<div>
			<div>
				{route.params.id}: {user.name}
			</div>
		</div>
	)
}
