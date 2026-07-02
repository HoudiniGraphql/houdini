import { Link } from '$houdini'

import type { LayoutProps } from './$types'

// The links live in the layout — above the error boundary — so they stay clickable while
// the page below shows +error.tsx, letting a test navigate away from the error state.
export default function ({ children }: LayoutProps) {
	return (
		<div>
			<Link id="to-good" to="/error-recovery/[id]" params={{ id: 1 }}>
				good
			</Link>
			<Link id="to-bad" to="/error-recovery/[id]" params={{ id: 999 }}>
				bad
			</Link>
			{children}
		</div>
	)
}
