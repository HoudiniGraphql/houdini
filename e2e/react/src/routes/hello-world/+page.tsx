import type { PageProps } from './$types'

export default function ({ HelloWorld }: PageProps) {
	return <div id="result">{HelloWorld.hello}</div>
}
