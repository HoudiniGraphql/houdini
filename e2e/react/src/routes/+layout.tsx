import { routes } from '~/utils/routes'

import type { LayoutProps } from './$types'

export default function ({ children }: LayoutProps) {
	let routesKvp = Object.keys(routes).map((key: string) => {
		return { key, value: (routes as Record<string, string>)[key] }
	})

	return (
		<>
			<div>{children}</div>
			<hr />
			<ul>
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
