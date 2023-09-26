import { graphql, useFragment, type SponsorInfo } from '$houdini'

type Props = {
	sponsor: SponsorInfo
}

export default function SponsorSummary(props: Props) {
	const data = useFragment(
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
			{data?.name}: {data?.Avatar}
		</div>
	)
}
