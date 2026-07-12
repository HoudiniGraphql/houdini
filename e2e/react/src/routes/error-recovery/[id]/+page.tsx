import type { PageProps } from './$types'

export default function ({ ErrorRecoveryQuery }: PageProps) {
	return <div id="name">{ErrorRecoveryQuery.user.name}</div>
}
