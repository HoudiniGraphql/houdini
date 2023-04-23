import { PendingValue } from '$houdini'

export default function ({ Session }) {
	// render the loading state
	if (Session.viewer === PendingValue) {
		return 'fetching...'
	}

	// we have a name to greet
	return <div>hello {Session.viewer.name}!</div>
}
