import { useState } from 'react'
import { graphql, useMutation, useSession } from '$houdini'

// Closes the loop between the imperative session infrastructure (setSession / @session mutations)
// and the client plugin pipeline. fetchParams (see src/+client.ts) forwards the CURRENT
// session.theme to the api as a header; requestSession echoes that header back. So after we update
// the session — imperatively via updateSession OR via a @session mutation — asking the api proves
// the NEW value is what actually gets sent.
export default function SessionToApiView() {
	const [session, updateSession] = useSession()
	const [apiSaw, setApiSaw] = useState('(none)')

	const [askApi] = useMutation(
		graphql(`
			mutation RequestSession {
				requestSession
			}
		`)
	)

	const [setThemeMutation] = useMutation(
		graphql(`
			mutation SetThemeForApi($theme: String!) @session(path: "setTheme.session", merge: true) {
				setTheme(theme: $theme) {
					session {
						theme
					}
				}
			}
		`)
	)

	return (
		<div>
			<p data-testid="local-theme">{session.theme ?? '(none)'}</p>
			<p data-testid="api-saw">{apiSaw}</p>

			<button
				data-testid="update-imperative"
				onClick={() => updateSession({ theme: 'set-imperatively' })}
			>
				update imperatively
			</button>
			<button
				data-testid="update-via-mutation"
				onClick={() => setThemeMutation({ variables: { theme: 'set-by-mutation' } })}
			>
				update via @session mutation
			</button>
			<button
				data-testid="ask-api"
				onClick={async () => {
					const data = await askApi({ variables: {} })
					setApiSaw(data?.requestSession ?? '(error)')
				}}
			>
				ask the api
			</button>
		</div>
	)
}
