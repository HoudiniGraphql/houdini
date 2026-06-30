import { getAuthUrl, HOUDINI_SESSION_EVENT, valueAtPath } from 'houdini/runtime'
import type { ClientPlugin } from 'houdini/runtime/documentStore'
import { ArtifactKind } from 'houdini/runtime/types'

// sessionRelay is the client half of @session. When a session mutation executes, the server
// signs the resolver's session subtree into a token in the response extensions
// (extensions.houdiniSession). This plugin relays that token to the auth endpoint, which
// verifies it and sets the httpOnly cookie — JS can't set httpOnly cookies itself — and then
// mirrors the same write into local state (a window event the router listens for) so
// useSession() updates without a refresh.
//
// It runs in the document pipeline, so it fires for ANY @session mutation execution
// (useMutation, useMutationForm, a raw send), not just form submits: session-by-mutation
// isn't tied to forms. The no-JS form path never reaches here (the server writes the cookie
// directly and marks its internal request so no token is minted).
export const sessionRelay = (): ClientPlugin => () => ({
	async end(ctx, { value, resolve }) {
		const artifact = ctx.artifact as typeof ctx.artifact & {
			sessionPath?: string
			sessionMerge?: boolean
		}
		const result = value as { data?: any; extensions?: Record<string, any> } | null
		// the local-Yoga path mints a token here for the client to relay; the remote-api proxy
		// instead writes the cookie itself and signals it with houdiniSessionApplied. Either way the
		// session changed and useSession() must mirror it.
		const token = result?.extensions?.houdiniSession
		const proxyApplied = result?.extensions?.houdiniSessionApplied === true
		const isSessionMutation = artifact.kind === ArtifactKind.Mutation && !!artifact.sessionPath
		if (isSessionMutation && typeof window !== 'undefined' && (token || proxyApplied)) {
			// relay the minted token to the auth endpoint to set the cookie. The proxy path already
			// set the cookie server-side (proxyApplied, no token), so there's nothing to relay there.
			if (token) {
				try {
					await fetch(getAuthUrl(), {
						method: 'POST',
						body: JSON.stringify({ token }),
						headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
					})
				} catch {
					// best-effort — if the relay fails the cookie just isn't updated this time
				}
			}

			// mirror the write into local state so useSession() updates without a refresh. A null
			// subtree clears (replace with {}); otherwise merge upserts and the default replaces. The
			// cookie (set by the relay or the proxy) stays the source of truth; this just reflects it.
			const next = valueAtPath(result?.data, artifact.sessionPath!.split('.'))
			window.dispatchEvent(
				new CustomEvent(HOUDINI_SESSION_EVENT, {
					bubbles: true,
					detail: {
						session: next ?? {},
						merge: next != null && !!artifact.sessionMerge,
					},
				})
			)
		}
		resolve(ctx)
	},
})
