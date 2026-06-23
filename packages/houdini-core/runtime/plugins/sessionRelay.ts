import { getAuthUrl } from 'houdini/runtime'
import type { ClientPlugin } from 'houdini/runtime/documentStore'
import { ArtifactKind } from 'houdini/runtime/types'

import { getCurrentConfig } from '../config.js'

// sessionRelay is the client half of @session. When a session mutation executes, the server
// signs the resolver's session subtree into a token in the response extensions
// (extensions.houdiniSession). This plugin relays that token to the auth endpoint, which
// verifies it and sets the httpOnly cookie — JS can't set httpOnly cookies itself.
//
// It runs in the document pipeline, so it fires for ANY @session mutation execution
// (useMutation, useMutationForm, a raw send), not just form submits: session-by-mutation
// isn't tied to forms. The no-JS form path never reaches here (the server writes the cookie
// directly and marks its internal request so no token is minted).
export const sessionRelay = (): ClientPlugin => () => ({
	async end(ctx, { value, resolve }) {
		const token = (value as { extensions?: Record<string, any> } | null)?.extensions
			?.houdiniSession
		// only client-side mutation executions carry a mint token; relay it to set the cookie
		if (token && ctx.artifact.kind === ArtifactKind.Mutation && typeof window !== 'undefined') {
			try {
				await fetch(getAuthUrl(getCurrentConfig()), {
					method: 'POST',
					body: JSON.stringify({ token }),
					headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
				})
			} catch {
				// best-effort — if the relay fails the cookie just isn't updated this time
			}
		}
		resolve(ctx)
	},
})
