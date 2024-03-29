import { useCache } from '$houdini/plugins/houdini-react/runtime/routing'
import React from 'react'
import { routes } from '~/utils/routes'

import type { LayoutProps } from './$types'

export default function ({ children }: LayoutProps) {
	// save the cache reference on the window
	const cache = useCache()
	React.useEffect(() => {
		if (globalThis.window) {
			// @ts-ignore
			globalThis.window.cache = cache
		}
	}, [])

	return (
		<>
			<div className="flex flex-row gap-2 mb-4 w-full flex-wrap">
				{Object.entries(routes).map(([route, url]) => {
					return (
						<a
							className="border-solid border-[var(--links)] border-2 p-2"
							key={url}
							href={url}
							data-houdini-preload
						>
							{route}
						</a>
					)
				})}
			</div>
			<div>{children}</div>
		</>
	)
}
