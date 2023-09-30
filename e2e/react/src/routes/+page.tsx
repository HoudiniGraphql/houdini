import SponsorInfo from '~/components/SponsorInfo'

import type { PageProps } from './$types'

export default function ({ SponsorList }: PageProps) {
	return (
		<div>
			{SponsorList.sponsors.map((sponsor) => {
				return (
					<div key={sponsor.name}>
						<SponsorInfo sponsor={sponsor} />
					</div>
				)
			})}
		</div>
	)
}
