import type { LayoutProps } from './$types'

export default function ({ HelloRouter, children }: LayoutProps) {
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
			message: {HelloRouter.message}
			<ul>
				<li>
					<a href="/">Home</a>
				</li>
				<li>
					<a href="/users/1">Bruce Willis</a>
				</li>
				<li>
					<a href="/users/2">Samuel Jackson</a>
				</li>
				<li>
					<a href="/users/3">Morgan Freeman</a>
				</li>
			</ul>
			<div>{children}</div>
		</div>
	)
}
