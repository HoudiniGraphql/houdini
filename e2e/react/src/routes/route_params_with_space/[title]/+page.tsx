import { useRoute } from '$houdini'

import type { PageProps, PageRoute } from './$types'

export default function ({ RouteParamsWithSpace }: PageProps) {
	const { location } = useRoute<PageRoute>()

	const { book } = RouteParamsWithSpace
	return (
		<div>
			<div id="result">
				{location.params.title}:{book?.title}
			</div>
		</div>
	)
}
