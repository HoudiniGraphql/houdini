import { PendingValue } from '$houdini'
import React from 'react'

export default function ({ UserInfo }) {
	const { user } = UserInfo

	// if we are loading the user render the loading state
	if (!user || user === PendingValue) {
		return 'loading user...'
	}

	const [count, setCount] = React.useState(0)

	// render the user information
	return (
		<div>
			<button onClick={() => setCount((c) => c + 1)}>{count}</button>
			<h1>{user.name}</h1>
		</div>
	)
}
