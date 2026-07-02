import { isPending } from '$houdini'

import type { PageProps } from './$types'

// The page query takes its delay from the `delay` search param, so a test can navigate
// between fast and slow variants of the same route. #name shows 'loading' while the page
// query is pending and the resolved name once it lands.
export default function ({ DelayedLoadingPage, DelayedLoadingPage$handle }: PageProps) {
	const user = DelayedLoadingPage.user

	return (
		<>
			<div id="name">{isPending(user.name) ? 'loading' : user.name}</div>
			{/* a render-time handle read: the loading frame must inject a real $handle
			    (built from a detached observer) or this line crashes during the frame */}
			<div id="handle">
				{DelayedLoadingPage$handle.fetching ? 'handle-fetching' : 'handle-idle'}
			</div>
		</>
	)
}
