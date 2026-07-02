import { Link, useNavigation } from '$houdini'

import type { LayoutProps } from './$types'

// No layout query on purpose — the route tree has no Suspense boundary of its own, so
// navigation behavior here exercises the router with nothing to catch a suspension.
export default function ({ children }: LayoutProps) {
	const navigation = useNavigation()

	return (
		<div>
			<div id="nav-status">
				{navigation.pending ? `navigating to ${navigation.to}` : 'idle'}
			</div>
			<Link id="to-slow" to="/delayed-loading-plain" search={{ delay: 1500 }}>
				slow
			</Link>
			<Link id="to-fast" to="/delayed-loading-plain" search={{ delay: 0 }}>
				fast
			</Link>
			{children}
		</div>
	)
}
