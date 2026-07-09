import { Suspense } from 'react'
import { graphql, useQuery, useSession } from '$houdini'

// A session-dependent useQuery: sessionTheme reflects the request's session (the
// x-session-theme header the client pipeline forwards, or the signed session cookie
// during SSR). The queried component is a sibling of the session controls, so after a
// session change the only thing that can refresh it is the suspense state being
// invalidated and refetched.
function SessionTheme() {
	const data = useQuery(
		graphql(`
			query UseQuerySessionTheme {
				sessionTheme
			}
		`)
	)

	return <div id="theme">{data.sessionTheme ?? '(none)'}</div>
}

function UpdateButton() {
	const [, updateSession] = useSession()

	return (
		<button
			id="set-theme"
			onClick={() => {
				// the theme can come from the url so tests can establish distinct sessions
				const theme =
					new URLSearchParams(window.location.search).get('theme') ?? 'updated-theme'
				updateSession({ theme })
			}}
		>
			set theme
		</button>
	)
}

export default function () {
	return (
		<>
			<Suspense fallback={<div id="fallback">loading</div>}>
				<SessionTheme />
			</Suspense>

			<UpdateButton />
		</>
	)
}
