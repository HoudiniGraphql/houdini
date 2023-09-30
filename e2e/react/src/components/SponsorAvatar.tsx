import type { GraphQL } from '$houdini'

type Props = {
	sponsor: GraphQL<`{
        ... on Sponsor @componentField(field: "Avatar") {
            avatarUrl
        }
    }`>
	size: number
}

export default function SponsorAvatar({ sponsor, size }: Props) {
	return <img src={sponsor.avatarUrl} height={50} />
}
