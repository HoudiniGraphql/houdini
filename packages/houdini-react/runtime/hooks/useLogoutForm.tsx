import { getCurrentConfig } from '$houdini/runtime'
import { getAuthUrl } from 'houdini/runtime'
import React from 'react'

import { useSession, useRoute } from '../routing/Router.js'

export type UseLogoutFormOptions = {
	// where to navigate after logout. The no-JS path 303s here from the server; the enhanced
	// path navigates with goto(). Defaults to '/'.
	redirectTo?: string
	// enhanced-path-only side effect (a no-op without JS, the correct degradation)
	onSuccess?: () => void
}

export type LogoutForm = {
	// spread onto a <form>: a real string action so the native POST clears the session before
	// hydration; the onSubmit intercepts after. Identical server/client → clean hydration.
	form: {
		action: string
		method: 'post'
		onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
	}
	// the hidden marker fields the no-JS POST needs; render inside the <form>
	hidden: React.ReactNode
}

/**
 * useLogoutForm renders a progressively-enhanced logout form. Without JS the native POST hits
 * the auth endpoint, which deletes the session cookie and 303s to `redirectTo`. After
 * hydration the onSubmit clears the session client-side (local state + cookie) and navigates.
 * It mirrors `useMutationForm`, but there's no mutation — logout is just "clear the session".
 */
export function useLogoutForm(opts: UseLogoutFormOptions = {}): LogoutForm {
	const [, updateSession] = useSession()
	const { goto } = useRoute()
	const redirectTo = opts.redirectTo ?? '/'

	const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		// only reached after hydration — before that the browser submits natively
		event.preventDefault()
		// null logs out: clears local state and deletes the cookie
		await updateSession(null)
		opts.onSuccess?.()
		goto(redirectTo)
	}

	const form: LogoutForm['form'] = {
		action: getAuthUrl(getCurrentConfig()),
		method: 'post',
		onSubmit,
	}

	const hidden = (
		<>
			<input type="hidden" name="__houdini_logout" value="1" />
			<input type="hidden" name="redirectTo" value={redirectTo} />
		</>
	)

	return { form, hidden }
}
