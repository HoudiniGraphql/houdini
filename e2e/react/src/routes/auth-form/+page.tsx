import { graphql, useMutationForm, useSession } from '$houdini'

// Progressively-enhanced login: @endpoint makes it a form (native POST before/without JS),
// @session makes the resolver's `login.session` become the session cookie. Both paths converge
// on the same session.
export default function AuthFormView() {
	const [session] = useSession()
	const { Form, state, pending } = useMutationForm(
		graphql(`
			mutation Login($username: String!)
				@endpoint(redirect: "/auth-form/done")
				@session(path: "login.session") {
				login(username: $username) {
					session {
						token
					}
				}
			}
		`)
	)

	return (
		<div>
			<p data-testid="session-token">{session.token ?? '(none)'}</p>
			<Form data-testid="login-form">
				<input name="username" data-testid="username-input" required />
				<button type="submit" data-testid="submit" disabled={pending}>
					{pending ? 'Signing in…' : 'Log in'}
				</button>
				{state?.errors && (
					<p role="alert" data-testid="error">
						{state.errors[0].message}
					</p>
				)}
			</Form>
		</div>
	)
}
