// external imports
import { logCyan, logRed, logYellow } from '@kitql/helper'
import { getContext as svelteContext, setContext } from 'svelte'
import { derived, get } from 'svelte/store'
// local imports
import { getPage, getSession } from '../adapter'
import { HoudiniFetchContext } from './types'

export const setVariables = (vars: () => {}) => setContext('variables', vars)

export const getHoudiniContext = (): HoudiniFetchContext => {
	const session = getSession()
	const url = derived([getPage()], ([$page]) => $page.url)

	try {
		return {
			url: () => url,
			session: () => session,
			variables: svelteContext('variables') || (() => ({})),
			stuff: {},
		}
	} catch (e) {
		console.error(
			`${logRed('getHoudiniContext() was not called in the right place.')}:
  You should do something like the following. Make sure getHoudiniContext is 
  called at the top of your component (outside any event handlers or function definitions).

  <script lang="ts">
    const ${logYellow('context')} = getHoudiniContext();
    await GQL_${logCyan('[YOUR_STORE]')}.mutate({ ${logYellow('context')}, variables: { ... } });
  </script>`
		)
		throw new Error(e as any)
	}
}
