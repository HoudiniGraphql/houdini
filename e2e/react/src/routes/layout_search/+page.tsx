import type { PageProps } from './$types'

export default function ({ LayoutChild }: PageProps) {
	return <div id="page-here">{LayoutChild.hello}</div>
}
