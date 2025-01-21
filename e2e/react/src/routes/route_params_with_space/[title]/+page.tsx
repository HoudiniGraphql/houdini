import { useRoute } from '$houdini'

import type { PageProps } from './$types'

export default function ({ RouteParamsWithSpace }: PageProps) {
	const route = useRoute<PageProps>()

	const { book } = RouteParamsWithSpace
	return (
		<div>
			<div id="result">
				{route.params.title}: {book?.title}
			</div>
		</div>
	)
}
