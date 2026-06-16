import type { PageProps } from './$types'

export default function ({ ErrorBoundaryTest }: PageProps) {
	return <div id="result">{ErrorBoundaryTest.errorTest}</div>
}
