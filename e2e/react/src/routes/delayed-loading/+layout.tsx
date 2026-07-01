import { isPending, Link } from '$houdini'

import type { LayoutProps } from './$types'

// The layout holds the persistent chrome (its own query) plus the nav links. Because the
// links live here (not in the page) they stay clickable while the page shows its loading
// state, and #chrome lets a test assert that a layout query is NOT re-loaded — and so does
// not flash — during a navigation that only re-fetches the page query.
export default function ({ children, DelayedLoadingChrome }: LayoutProps) {
	const user = DelayedLoadingChrome.user

	return (
		<div>
			<div id="chrome">{isPending(user.name) ? 'chrome-loading' : user.name}</div>
			<Link id="to-slow" to="/delayed-loading" search={{ delay: 1500 }}>
				slow
			</Link>
			<Link id="to-fast" to="/delayed-loading" search={{ delay: 0 }}>
				fast
			</Link>
			<Link id="to-min" to="/delayed-loading" search={{ delay: 200 }}>
				min
			</Link>
			{children}
		</div>
	)
}
