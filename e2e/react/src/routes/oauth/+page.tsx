import { loginURL, useSession } from '$houdini'

// First-class OAuth e2e: the loginURL link kicks off the flow against the stub provider. After the
// full round-trip (Houdini /login -> stub /authorize -> callback -> onSignIn) the session carries
// the user, which this page reads back via useSession.
export default function OAuthView() {
	const [session] = useSession()

	if (session.userId) {
		return (
			<div>
				<p data-testid="who">{session.email}</p>
				<p data-testid="user-id">{session.userId}</p>
			</div>
		)
	}

	return (
		<a data-testid="login" href={loginURL({ provider: 'stub', redirectTo: '/oauth' })}>
			Log in
		</a>
	)
}
