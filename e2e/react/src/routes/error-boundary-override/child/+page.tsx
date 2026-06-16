import type { PageProps } from './$types'

export default function ({ ErrorBoundaryOverrideTest }: PageProps) {
	return <div id="result">{ErrorBoundaryOverrideTest.errorTest}</div>
}
