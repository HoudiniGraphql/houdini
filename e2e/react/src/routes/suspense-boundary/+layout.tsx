import { Suspense } from 'react'
import { Link, useNavigation } from '$houdini'

import type { LayoutProps } from './$types'

// A user-owned Suspense boundary around the page slot. It gets classic React semantics
// (immediate fallback when the boundary is newly mounted, held content when it isn't),
// not the router's delayed-loading treatment — the tests pin exactly that contract.
export default function ({ children }: LayoutProps) {
	const navigation = useNavigation()

	return (
		<div>
			<div id="nav-status">
				{navigation.pending ? `navigating to ${navigation.to}` : 'idle'}
			</div>
			<Link id="to-slow" to="/suspense-boundary" search={{ delay: 1500 }}>
				slow
			</Link>
			<Link id="to-fast" to="/suspense-boundary" search={{ delay: 0 }}>
				fast
			</Link>
			<Suspense fallback={<div id="user-fallback">user loading</div>}>{children}</Suspense>
		</div>
	)
}
