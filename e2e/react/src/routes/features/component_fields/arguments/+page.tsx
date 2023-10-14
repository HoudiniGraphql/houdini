import type { PageProps } from './$types'
import CF_A_SponsorInfo from './CF_A_SponsorInfo'

export default function ({ features__component_fields__arguments }: PageProps) {
	return (
		<div>
			{features__component_fields__arguments.sponsors.map((sponsor) => {
				return (
					<div key={sponsor.name}>
						<CF_A_SponsorInfo sponsor={sponsor} />
					</div>
				)
			})}
		</div>
	)
}
