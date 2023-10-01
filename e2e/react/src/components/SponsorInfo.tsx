import { graphql, type SponsorInfo, useFragment } from '$houdini'

type Props = {
	sponsor: SponsorInfo
}

export default function SponsorSummary(props: Props) {
	const data = useFragment(
		props.sponsor,
		graphql(`
			fragment SponsorInfo on Sponsor {
				name
				avatarUrl
			}
		`)
	)

	return <div>{data?.name}</div>
}
