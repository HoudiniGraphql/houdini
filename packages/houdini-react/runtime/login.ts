import { getAuthUrl } from 'houdini/runtime'

// loginURL builds the URL for Houdini's redirect-login entry point (`/login`). Point a link at it
// to start the flow: `redirectTo` is where the user lands afterward (passed as a query param on
// this initial request, then captured into a signed cookie server-side for the OAuth round-trip) —
// omit it to return the user to the page they came from. `params`
// are forwarded verbatim to the trusted integration (e.g. `{ provider: 'github' }`) — Houdini stays
// out of the provider business.
//
// This helper is only exported from `$houdini` when `auth.redirect` is configured in
// `src/server/+config`; without a trusted integration there is no flow to start.
export function loginURL(opts?: { redirectTo?: string; params?: Record<string, string> }): string {
	const search = new URLSearchParams()
	if (opts?.redirectTo) {
		search.set('redirectTo', opts.redirectTo)
	}
	for (const [key, value] of Object.entries(opts?.params ?? {})) {
		search.set(key, value)
	}
	const qs = search.toString()
	return `${getAuthUrl()}/login${qs ? `?${qs}` : ''}`
}
