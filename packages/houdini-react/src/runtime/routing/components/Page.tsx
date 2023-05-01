import React from 'react'

export function Page({
	Component,
	queries,
}: {
	Component: () => React.ReactElement
	queries: string[]
}) {
	return <Component />
}
