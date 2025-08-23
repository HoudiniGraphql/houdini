import type { GraphQL } from '$houdini'

type Props = {
	user: GraphQL<`{
        ... on User @componentField(field: "Avatar"){
            avatarURL
        }
    }`>
}

export default function UserAvatar({ user }: Props) {
	return (
		<>
			<img src={user.avatarURL} height={30} width={30} />
		</>
	)
}
