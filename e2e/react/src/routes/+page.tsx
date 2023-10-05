import SponsorInfo from '~/components/SponsorInfo'

import type { PageProps } from './$types'

export default function ({ SponsorList }: PageProps) {
	return (
		<>
			<h1>Houdini's React Interation tests</h1>
			<div>
				{SponsorList.sponsors.map((sponsor) => {
					return (
						<div key={sponsor.name}>
							<SponsorInfo sponsor={sponsor} />
						</div>
					)
				})}
			</div>
			<p>This is the HOME page. 🫵 can navigate with links 👇</p>
		</>
	)
}
