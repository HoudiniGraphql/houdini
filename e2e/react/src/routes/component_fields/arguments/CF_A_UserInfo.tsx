import { graphql, type CF_A_UserInfo, useFragment } from '$houdini'

type Props = {
	user: CF_A_UserInfo
}

export default function UserInfo(props: Props) {
	const user = useFragment(
		props.user,
		graphql(`
			fragment CF_A_UserInfo on User {
				name
				CF_A_UserAvatar(size: 100)
			}
		`)
	)

	return (
		<div>
			{user?.name}: <user.CF_A_UserAvatar />
		</div>
	)
}
