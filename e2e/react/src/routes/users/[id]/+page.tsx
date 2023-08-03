import { isPending } from '$houdini'
import React from 'react'

import type { PageProps } from './$types'

export default function ({ UserInfo }: PageProps) {
	const { user } = UserInfo

	// if we are loading the user render the loading state
	if (isPending(user)) {
		return 'loading user...'
	}

	const [count, setCount] = React.useState(0)

	// render the user information
	return (
		<div>
			<h1>{user.name}</h1>
			<button onClick={() => setCount((c) => c + 1)}>{count}</button>
		</div>
	)
}
