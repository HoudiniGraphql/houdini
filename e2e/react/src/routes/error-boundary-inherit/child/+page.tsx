import type { PageProps } from './$types'

export default function ({ ErrorBoundaryInheritTest }: PageProps) {
	return <div id="result">{ErrorBoundaryInheritTest.errorTest}</div>
}
