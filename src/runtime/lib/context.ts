import { getContext as svelteContext, setContext } from 'svelte'
import { Writable } from 'svelte/store'

import { getSession } from '../adapter'
import * as log from './log'
import {
	CompiledQueryKind,
	CompiledMutationKind,
	CompiledFragmentKind,
	HoudiniFetchContext,
	GraphQLTagResult,
} from './types'

export const setVariables = (vars: () => {}) => setContext('variables', vars)

export function nullHoudiniContext(): HoudiniFetchContext {
	return {
		variables: async () => {},
	}
}

export function getHoudiniContext(suppressLogs?: boolean): HoudiniFetchContext {
	try {
		return {
			variables: svelteContext('variables') || (() => ({})),
		}
	} catch (e) {
		if (!suppressLogs) {
			log.info(
				`${log.red('⚠️ getHoudiniContext() was not called in the right place ⚠️')}
You should do something like the following. Make sure getHoudiniContext is
called at the top of your component (outside any event handlers or function definitions).

<script lang="ts">
    const ${log.yellow('context')} = getHoudiniContext();
    const onClick = () => GQL_${log.cyan('[YOUR_STORE]')}.mutate({ ${log.yellow('context')} });
</script>`
			)
		}
		throw new Error(e as any)
	}
}

export function injectContext(props: any[]) {
	// grab the current context
	const context = getHoudiniContext()

	// we need to find every store and attach the current context
	for (const value of props) {
		if (
			typeof value !== 'object' ||
			!('kind' in value) ||
			![CompiledQueryKind, CompiledMutationKind, CompiledFragmentKind].includes(value.kind)
		) {
			continue
		}

		// we found a store! set its context
		let store = value as GraphQLTagResult
		if ('setContext' in store) {
			store.setContext(context)
		}
	}
}
