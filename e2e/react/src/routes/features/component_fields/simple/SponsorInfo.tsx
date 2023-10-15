import { graphql, type SponsorInfo, useFragment } from '$houdini'

type Props = {
	sponsor: SponsorInfo
}

export default function SponsorSummary(props: Props) {
	const sponsor = useFragment(
		props.sponsor,
		graphql(`
			fragment SponsorInfo on Sponsor {
				name
				Avatar
			}
		`)
	)

	return (
		<div>
			{sponsor?.name}: <sponsor.Avatar />
		</div>
	)
}
