import manifest from '$houdini/plugins/houdini-react/manifest.json'
import { useCache } from '$houdini/plugins/houdini-react/runtime/routing'
import React from 'react'

import type { LayoutProps } from './$types'

export default function ({ children }: LayoutProps) {
	// save the cache reference on the window
	const cache = useCache()
	React.useEffect(() => {
		if (globalThis.window) {
			// @ts-ignore
			globalThis.window.cache = cache
		}
	})

	return (
		<>
			<ul style={{ listStyle: 'none' }}>
				{Object.values(manifest.pages).map((route) => {
					return (
						<li key={route.url}>
							<a href={route.url} data-houdini-preload>
								{route.url}
							</a>
						</li>
					)
				})}
			</ul>
			<hr />
			<div>{children}</div>
		</>
	)
}
