import { useCache } from '$houdini/plugins/houdini-react/runtime/routing'
import React from 'react'
import { routes } from '~/utils/routes'

import type { LayoutProps } from './$types'
import './index.css'

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
				{Object.entries(routes).map(([route, url]) => {
					return (
						<li key={url}>
							<a href={url} data-houdini-preload>
								{route}
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
