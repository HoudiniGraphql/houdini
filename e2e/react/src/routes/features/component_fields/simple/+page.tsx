import SponsorInfo from './SponsorInfo'

export default ({ SponsorList }) => {
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
