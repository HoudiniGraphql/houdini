import { useRoute } from '$houdini'

import type { LayoutProps, LayoutRoute } from './$types'

// the layout declares its own nullable query variable ($limit), which becomes a LayoutRoute
// search param readable here via useRoute<LayoutRoute>()
export default function ({ children }: LayoutProps) {
	const { search } = useRoute<LayoutRoute>()
	return (
		<div>
			<div id="layout-limit">{JSON.stringify(search.limit ?? null)}</div>
			{children}
		</div>
	)
}
