import { useTransition } from 'react'

import { useNavigation, useSession } from '$houdini'

import type { PageProps } from './$types'

// The page query's $snapshot variable is fed by the UsersSnapshotFromSession runtime scalar
// (see houdini.config.ts), so the data on screen is derived from the session. The buttons are
// the only interaction: they update the session, which must refire the query with the new
// snapshot — an app that keeps the current organization in the session, in miniature.
export default function ({ SessionQueryRefetch }: PageProps) {
	const [, updateSession] = useSession()
	const { goto } = useNavigation()
	const [, startTransition] = useTransition()

	return (
		<div>
			<div data-testid="users">
				{SessionQueryRefetch.usersList.map((user) => (
					<div key={user.id}>{user.id}</div>
				))}
			</div>
			{/* the plain shape: nothing else happens alongside the session write */}
			<button
				data-testid="switch-snapshot"
				onClick={() => updateSession({ snapshot: 'session-query-refetch-next' })}
			>
				switch snapshot
			</button>
			{/* the org-switcher shape: the session write shares a transition with a navigation,
			    so another render (the urgent pending-url update) lands before the new session
			    state commits */}
			<button
				data-testid="switch-snapshot-goto"
				onClick={() =>
					startTransition(() => {
						updateSession({ snapshot: 'session-query-refetch-goto' })
						goto('/session-query-refetch')
					})
				}
			>
				switch snapshot and navigate
			</button>
		</div>
	)
}
