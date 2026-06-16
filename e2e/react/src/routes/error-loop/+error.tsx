import { isRoutingError } from '$houdini'
import type { ErrorProps } from './$types'

export default function ErrorLoopError({ errors }: ErrorProps) {
	const routing = errors.find(isRoutingError)
	if (routing) return <div id="error-message">routing-error: {routing.status}</div>
	return <div id="error-message">{errors[0]?.message}</div>
}
