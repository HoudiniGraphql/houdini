import { graphql, useMutation, useSession } from '$houdini'

// @session via a plain useMutation — NO form, no useMutationForm. The sessionRelay client
// plugin relays the minted token to the auth endpoint after the mutation runs, so the cookie
// is written even though nothing here touches the session directly. Proves session-by-mutation
// isn't tied to forms.
export default function SessionMutationView() {
	const [session] = useSession()
	const [setTheme] = useMutation(
		graphql(`
			mutation SetThemeProgrammatic($theme: String!)
				@session(path: "setTheme.session", merge: true) {
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
			<p data-testid="session-theme">{session.theme ?? '(none)'}</p>
			<button data-testid="submit" onClick={() => setTheme({ variables: { theme: 'dark' } })}>
				Set dark theme
			</button>
		</div>
	)
}
