import manifest from '$houdini/plugins/houdini-react/manifest.json'
import { useCache } from '$houdini/plugins/houdini-react/runtime/routing'

import type { LayoutProps } from './$types'

export default function ({ children }: LayoutProps) {
	let routesKvp = Object.values(manifest.pages).map((page) => ({
		key: page.url,
		value: page.url,
	}))

	if (globalThis.window)
		// @ts-ignore
		globalThis.window.cache = useCache()

	return (
		<>
			<div>{children}</div>
			<hr />
			<ul style={{ listStyle: 'none' }}>
				{routesKvp.map((route) => {
					return (
						<li key={route.value}>
							<a href={route.value} data-houdini-preload>
								{route.key}
							</a>
						</li>
					)
				})}
			</ul>
		</>
	)
}
