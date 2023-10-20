import { graphql, type UserInfo, useFragment } from '$houdini'

type Props = {
	user: UserInfo
}

export default function UserSummary(props: Props) {
	const user = useFragment(
		props.user,
		graphql(`
			fragment UserInfo on User {
				name
				Avatar
			}
		`)
	)

	return (
		<div>
			{user?.name}: <user.Avatar />
		</div>
	)
}
