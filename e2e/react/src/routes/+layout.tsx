import { Link, useCache, type ExternalHref } from '$houdini'
import React from 'react'
import { routes } from '~/utils/routes'

import type { LayoutProps } from './$types'

export default function ({ children }: LayoutProps) {
	// save the cache reference on the window
	const cache = useCache()
	React.useEffect(() => {
		if (globalThis.window) {
			// @ts-expect-error: window.cache is a test-only property used by Playwright tests
			globalThis.window.cache = cache
		}
	}, [])

	return (
		<>
			<div className="flex flex-row gap-2 mb-4 w-full flex-wrap">
				{Object.entries(routes).map(([route, url]: [string, string]) => {
					return (
						<Link
							className="border-solid border-[var(--links)] border-2 p-2"
							key={url}
							// the routes map holds concrete already-filled urls, not route patterns
							to={url as ExternalHref}
							preload
						>
							{route}
						</Link>
					)
				})}
			</div>
			<div>{children}</div>
		</>
	)
}
