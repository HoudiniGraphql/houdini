import type { LayoutProps } from './$types'

export function headers() {
	return {
		'X-Houdini-Layout': 'layout-value',
		'X-Houdini-Shared': 'from-layout',
	}
}

export default function ResponseHeadersLayout({ children }: LayoutProps) {
	return <>{children}</>
}
