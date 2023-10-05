import type { GraphQL } from '$houdini'

type Props = {
	sponsor: GraphQL<`{
        ... on Sponsor @componentField(field: "Avatar"){
            avatarUrl
        }
    }`>
}

export default function SponsorAvatar({ sponsor }: Props) {
	return (
		<>
			<img src={sponsor.avatarUrl} height={30} width={30} />
		</>
	)
}
