import type { ErrorProps } from './$types'

export default function ErrorRecoveryError({ errors }: ErrorProps) {
	return <div id="error-message">{errors[0]?.message}</div>
}
