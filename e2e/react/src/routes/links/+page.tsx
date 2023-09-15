import type { PageProps } from './$types'

export default function ({ LinkList }: PageProps) {
	return <div>{JSON.stringify(LinkList)}</div>
}
