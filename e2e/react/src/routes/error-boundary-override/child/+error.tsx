import type { ErrorProps } from './$types'

export default function ChildErrorBoundary({ errors }: ErrorProps) {
	return <div id="error-message">child: {errors[0]?.message}</div>
}
