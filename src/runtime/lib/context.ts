// external imports
import { setContext, getContext as svelteContext } from 'svelte'
import { readable } from 'svelte/store'
// local imports
import { HoudiniFetchContext } from './types'
import { getPage, getSession } from '../adapter'
import { logCyan, logRed, logYellow } from '@kitql/helper'

export const setVariables = (vars: () => {}) => setContext('variables', vars)

export const getHoudiniContext = (): HoudiniFetchContext => {
	try {
		const session = getSession()
		return {
			page: getPage(),
			session: session?.subscribe ? session : readable(session),
			variables: svelteContext('variables') || (() => ({})),
			stuff: {},
		}
	} catch (e) {
		console.error(
			`${logRed('getHoudiniContext() was not called in the right place.')}:
      You should do something like 👇 (because context should be filled at the start of the component)

      <script lang="ts">
        const ${logYellow('context')} = getHoudiniContext();
        await GQL_${logCyan('[YOUR_STORE]')}.mutate({ ${logYellow(
				'context'
			)}, variables: { ... } });
      </script>`
		)
		throw new Error(e as any)
	}
}
