import { PendingValue } from '$houdini'

export default function ({ UserInfo }) {
	const user = UserInfo.node

	// if we are loading the user render the loading state
	if (user === PendingValue) {
		return 'loading user...'
	}

	// render the user information
	return (
		<div>
			<h1>User {user.id}</h1>
		</div>
	)
}
