import type { PageProps } from './$types'

export default function ({ HelloWorld }: PageProps) {
	return <div>{HelloWorld.hello}</div>
}
