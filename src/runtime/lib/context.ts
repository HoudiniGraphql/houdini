import { getContext as svelteContext, setContext } from 'svelte'
import { get } from 'svelte/store'

import { getPage, getSession } from '../adapter'
import * as log from './log'
import { CompiledQueryKind, HoudiniFetchContext, QueryStore } from './types'

export const setVariables = (vars: () => {}) => setContext('variables', vars)

export function nullHoudiniContext(): HoudiniFetchContext {
	return {
		url: () => null,
		session: () => null,
		variables: async () => {},
		stuff: () => ({}),
	}
}

export function getHoudiniContext(): HoudiniFetchContext {
	try {
		// hold onto references to the current session and url values
		const sessionStore = getSession()
		let session: App.Session | null = null
		sessionStore.subscribe((val) => (session = val))

		const pageStore = getPage()
		let { url, stuff } = get(pageStore)
		pageStore.subscribe((val) => {
			url = val.url
			stuff = val.stuff
		})

		return {
			url: () => url,
			session: () => session,
			variables: svelteContext('variables') || (() => ({})),
			stuff: () => stuff,
		}
	} catch (e) {
		log.info(
			`${log.red('⚠️ getHoudiniContext() was not called in the right place ⚠️')}
You should do something like the following. Make sure getHoudiniContext is 
called at the top of your component (outside any event handlers or function definitions).

<script lang="ts">
    const ${log.yellow('context')} = getHoudiniContext();
    const onClick = () => GQL_${log.cyan('[YOUR_STORE]')}.mutate({ ${log.yellow('context')} });
</script>`
		)
		throw new Error(e as any)
	}
}

export function injectContext(props: Record<string, any>) {
	// grab the current context
	const context = getHoudiniContext()

	// we need to find every store and attach the current context
	for (const value of Object.values(props)) {
		if (typeof value !== 'object' || !('kind' in value) || value.kind !== CompiledQueryKind) {
			continue
		}

		// we found a store!
		let store = value as QueryStore<unknown, unknown>
		// set its context
		store.setContext(context)
	}
}
