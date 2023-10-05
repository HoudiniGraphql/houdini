import type { GraphQL } from '$houdini'

type Props = {
	sponsor: GraphQL<`{
        ... on Sponsor 
						@componentField(field: "CF_A_SponsorAvatar")
						@arguments(size: { type: "Int" })
				{
            avatarUrl(size: $size)
        }
    }`>
}

export default function CF_A_SponsorAvatar({ sponsor }: Props) {
	return (
		<>
			<img src={sponsor.avatarUrl} height={50} />
		</>
	)
}
