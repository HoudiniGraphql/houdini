import type { PageProps } from './$types'

export default function ({ HelloWorld }: PageProps) {
	return <div>{JSON.stringify(HelloWorld)}</div>
}
