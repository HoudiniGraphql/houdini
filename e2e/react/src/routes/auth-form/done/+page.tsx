import { useLogoutForm, useSession } from '$houdini'

// The post-login landing page. It reads the session from the cookie (so the test can prove
// login set it on both paths) and offers a progressively-enhanced logout.
export default function AuthDoneView() {
	const [session] = useSession()
	const { form, hidden } = useLogoutForm({ redirectTo: '/auth-form' })

	return (
		<div>
			<p data-testid="session-token">{session.token ?? '(none)'}</p>
			<form {...form} data-testid="logout-form">
				{hidden}
				<button type="submit" data-testid="logout">
					Log out
				</button>
			</form>
		</div>
	)
}
