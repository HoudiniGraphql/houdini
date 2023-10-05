import type { GraphQL } from '$houdini'

type Props = {
	sponsor: GraphQL<`{
        ... on Sponsor 
						@componentField(field: "Avatar")
						@arguments(size: { type: "Int" })
				{
            avatarUrl(size: $size)
        }
    }`>
}

export default function SponsorAvatar({ sponsor }: Props) {
	return (
		<>
			<img src={sponsor.avatarUrl} height={50} />
		</>
	)
}
