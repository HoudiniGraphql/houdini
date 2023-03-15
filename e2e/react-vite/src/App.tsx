import { graphql } from '$houdini'
import * as React from 'react'

export default function App() {
	return (
		<React.Suspense fallback="loading...">
			<Child />
		</React.Suspense>
	)
}

function Child() {
	const data = useTest(1)
	return <div>{JSON.stringify(data)}</div>
}

let data: any = null

function useTest(id: number) {
	const promise = React.useRef<Promise<any> | null>(null)
	console.log('render', promise)
	if (data) {
		return data
	}

	throw new Promise((resolve) => {
		setTimeout(() => {
			data = { hello: 'world' + id }
			resolve()
		}, 1000)
	})
}

graphql(``)
