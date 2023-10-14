import { graphql, type SponsorInfo, useFragment } from '$houdini'

type Props = {
	sponsor: SponsorInfo
}

export default function CF_A_SponsorInfo(props: Props) {
	const sponsor = useFragment(
		props.sponsor,
		graphql(`
			fragment CF_A_SponsorInfo on Sponsor {
				name
				CF_A_SponsorAvatar(size: 50)
			}
		`)
	)

	return (
		<div>
			{sponsor?.name}: <sponsor.CF_A_SponsorAvatar />
		</div>
	)
}
