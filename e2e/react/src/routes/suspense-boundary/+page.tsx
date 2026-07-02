import type { PageProps } from './$types'

// No @loading on purpose: the page's suspension lands in the layout's hand-rolled
// Suspense boundary instead of a generated loading frame.
export default function ({ SuspenseBoundaryPage }: PageProps) {
	return <div id="name">{SuspenseBoundaryPage.user.name}</div>
}
