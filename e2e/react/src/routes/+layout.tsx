import type { LayoutProps } from './$types'

export default function ({ children }: LayoutProps) {
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
			Layout!
			<div>
				<a href="/" data-houdini-preload>
					Sponsors
				</a>
				<a href="/links" data-houdini-preload>
					Links
				</a>
			</div>
			<div>{children}</div>
		</div>
	)
}
