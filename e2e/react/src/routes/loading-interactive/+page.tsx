import { isPending } from '$houdini'
import * as React from 'react'

import type { PageProps } from './$types'

// The simplest possible reproduction of issue #1408's underlying cause: a page whose
// query is marked @loading renders its loading frame inside a streaming Suspense
// boundary. Once the data resolves the real markup is swapped in by the server stream,
// but the client must still hydrate it so the page is interactive. This button proves
// that: if hydration never commits, the counter stays at 0 no matter how many times
// it is clicked.
export default function ({ LoadingInteractiveQuery }: PageProps) {
	const user = LoadingInteractiveQuery.user
	const [count, setCount] = React.useState(0)

	return (
		<>
			<div id="name">{isPending(user.name) ? 'loading' : user.name}</div>
			<div id="count">{count}</div>
			<button id="increment" onClick={() => setCount((c) => c + 1)}>
				increment
			</button>
		</>
	)
}
