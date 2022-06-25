// external imports
import { logCyan, logRed, logYellow } from '@kitql/helper'
import { getContext as svelteContext, setContext } from 'svelte'
import { get } from 'svelte/store'
// local imports
import { getPage, getSession } from '../adapter'
import { HoudiniFetchContext } from './types'

export const setVariables = (vars: () => {}) => setContext('variables', vars)

export function nullHoudiniContext(): HoudiniFetchContext {
	return {
		url: () => null,
		session: () => null,
		variables: async () => {},
		stuff: {},
	}
}

export function getHoudiniContext(): HoudiniFetchContext {
	try {
		// hold onto references to the current session and url values
		const sessionStore = getSession()
		let session: App.Session | null = null
		sessionStore.subscribe((val) => (session = val))

		const pageStore = getPage()
		let url = get(pageStore).url
		pageStore.subscribe((val) => (url = val.url))

		return {
			url: () => url,
			session: () => session,
			variables: svelteContext('variables') || (() => ({})),
			stuff: {},
		}
	} catch (e) {
		console.log(
			`${logRed('⚠️ getHoudiniContext() was not called in the right place ⚠️')}
You should do something like the following. Make sure getHoudiniContext is 
called at the top of your component (outside any event handlers or function definitions).

<script lang="ts">
    const ${logYellow('context')} = getHoudiniContext();
    const onClick = () => GQL_${logCyan('[YOUR_STORE]')}.mutate({ ${logYellow('context')} });
</script>`
		)
		throw new Error(e as any)
	}
}
