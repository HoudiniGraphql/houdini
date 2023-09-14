import type { PageProps } from './$types'

export default function ({ SponsorList }: PageProps) {
	return <div>{JSON.stringify(SponsorList)}</div>
}
