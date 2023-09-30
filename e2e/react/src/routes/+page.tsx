import type { PageProps } from './$types'

export default function ({ SponsorList }: PageProps) {
	return (
		<div>
			{SponsorList.sponsors.map((sponsor) => {
				return (
					<div key={sponsor.name}>
						{sponsor.name} <sponsor.Avatar size={10} />
					</div>
				)
			})}
		</div>
	)
}
