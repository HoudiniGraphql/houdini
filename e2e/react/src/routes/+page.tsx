import type { PageProps } from './$types'

export default function ({ HelloRouter }: PageProps) {
	return <div>{HelloRouter.message}!</div>
}
