import type { PageProps } from './$types'

export default function ({ RouteParamsUserInfo }: PageProps) {
	const { user } = RouteParamsUserInfo
	return (
		<div>
			<div>{user.name}</div>
		</div>
	)
}
