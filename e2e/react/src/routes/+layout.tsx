import type { LayoutProps } from './$types'

export default function ({ children }: LayoutProps) {
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
			Layout!
			<div>
				<a href="/">Sponsors</a>
				<a href="/links">Links</a>
			</div>
			<div>{children}</div>
		</div>
	)
}
