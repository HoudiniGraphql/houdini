import type { PageProps } from './$types'

export default function ({ HelloWorld }: PageProps) {
	return <h1>{HelloWorld.hello}</h1>
}
