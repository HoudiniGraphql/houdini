import type { GraphQL } from '$houdini'

type Props = {
	user: GraphQL<`{
        ... on User
			@componentField(field: "CF_A_UserAvatar")
			@arguments(size: { type: "Int" })
		{
            avatarURL(size: $size)
        }
    }`>
}

export default function CF_A_UserAvatar({ user }: Props) {
	return (
		<>
			<img src={user?.avatarURL} width={100} />
		</>
	)
}
