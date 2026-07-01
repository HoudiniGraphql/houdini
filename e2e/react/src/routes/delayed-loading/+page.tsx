import { isPending } from '$houdini'

import type { PageProps } from './$types'

// The page query takes its delay from the `delay` search param, so a test can navigate
// between fast and slow variants of the same route. #name shows 'loading' while the page
// query is pending and the resolved name once it lands.
export default function ({ DelayedLoadingPage }: PageProps) {
	const user = DelayedLoadingPage.user

	return <div id="name">{isPending(user.name) ? 'loading' : user.name}</div>
}
