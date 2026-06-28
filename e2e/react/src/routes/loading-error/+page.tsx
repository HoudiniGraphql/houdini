import { isPending } from '$houdini'

import type { PageProps } from './$types'

// A page whose query is marked @loading streams its loading frame inside a Suspense boundary
// before the query resolves. When the query errors (user id 999 doesn't exist, so the resolver
// throws) the page must reach the +error.tsx boundary instead of hanging on the loading frame.
export default function ({ LoadingErrorQuery }: PageProps) {
	const user = LoadingErrorQuery.user

	return <div id="name">{isPending(user.name) ? 'loading' : user.name}</div>
}
