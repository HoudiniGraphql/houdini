import React from 'react'

export function Fallback({
	queries,
	children,
}: {
	queries: string[]
	children: React.ReactElement
	Component: (props: any) => React.ReactElement
}) {
	// TODO: +fallback.tsx
	let fallback = <div>loading...</div>

	return <React.Suspense fallback={fallback}>{children}</React.Suspense>
}
