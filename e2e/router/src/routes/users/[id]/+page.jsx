import { PendingValue } from '$houdini'

export default function ({ UserInfo }) {
	const { user } = UserInfo

	// if we are loading the user render the loading state
	if (!user || user === PendingValue) {
		return 'loading user...'
	}

	// render the user information
	return (
		<div>
			<h1>{user.name}</h1>
		</div>
	)
}
