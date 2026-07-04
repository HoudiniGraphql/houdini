import type { PageProps } from './$types'

// This page intentionally has no @loading state: it pins the delayed-loading feature's
// degradation path, where a slow navigation holds the previous page for the whole
// transition instead of rendering a loading frame.
export default function ({ DelayedLoadingPlainPage }: PageProps) {
	return <div id="name">{DelayedLoadingPlainPage.user.name}</div>
}
