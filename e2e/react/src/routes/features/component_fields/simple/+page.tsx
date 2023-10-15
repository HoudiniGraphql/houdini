import { PageProps } from './$types'
import SponsorInfo from './SponsorInfo'

export default ({ features__component_fields__simple }: PageProps) => {
	return (
		<div>
			{features__component_fields__simple.sponsors.map((sponsor) => {
				return (
					<div key={sponsor.name}>
						<SponsorInfo sponsor={sponsor} />
					</div>
				)
			})}
		</div>
	)
}
