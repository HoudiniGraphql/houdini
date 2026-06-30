import { HoudiniClient } from '$houdini'

// Export the Houdini client. fetchParams reads the CURRENT session on every request and forwards
// session.theme to the api as a header — the session-to-api e2e asserts the api receives whatever
// we last set client-side (imperatively or via a @session mutation), closing the loop between the
// session infrastructure and the client plugin pipeline.
export default new HoudiniClient({
	fetchParams({ session }) {
		return {
			headers: {
				'x-session-theme': session?.theme ?? '',
			},
		}
	},
})
