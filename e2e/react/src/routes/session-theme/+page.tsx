import { graphql, useMutationForm, useSession } from '$houdini'

// A preference written by a mutation with @session(merge: true): setTheme returns a session
// subtree { theme } that is *merged* into the existing session, so a logged-in user keeps
// their token. Not auth — just "session by mutation".
export default function SessionThemeView() {
	const [session] = useSession()
	const { Form, pending } = useMutationForm(
		graphql(`
			mutation SetTheme($theme: String!) @session(path: "setTheme.session", merge: true) {
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
			<p data-testid="session-token">{session.token ?? '(none)'}</p>
			<p data-testid="session-theme">{session.theme ?? '(none)'}</p>
			<Form data-testid="theme-form">
				<input type="hidden" name="theme" value="dark" />
				<button type="submit" data-testid="submit" disabled={pending}>
					Use dark theme
				</button>
			</Form>
		</div>
	)
}
