import type { ErrorProps } from './$types'

export default function ParentErrorBoundary({ errors }: ErrorProps) {
	return <div id="error-message">parent: {errors[0]?.message}</div>
}
