import { cache } from '$houdini/runtime'
import SponsorInfo from '~/components/SponsorInfo'

import type { PageProps } from './$types'

if (globalThis.window) {
	// @ts-ignore
	window.cache = cache
}

export default function ({ SponsorList }: PageProps) {
	return (
		<div>
			{SponsorList.sponsors.map((sponsor) => (
				<div key={sponsor.name}>
					<SponsorInfo sponsor={sponsor} />
				</div>
			))}
		</div>
	)
}
