import { Link } from '$houdini'

import type { LayoutProps } from './$types'

// Links live above the page so they stay clickable while the loading frame shows.
export default function ({ children }: LayoutProps) {
	return (
		<div>
			<Link id="to-slow" to="/delayed-loading-pagination" search={{ delay: 1500 }}>
				slow
			</Link>
			<Link id="to-fast" to="/delayed-loading-pagination" search={{ delay: 0 }}>
				fast
			</Link>
			{children}
		</div>
	)
}
