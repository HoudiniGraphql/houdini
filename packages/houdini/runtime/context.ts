import { setContext, getContext } from 'svelte'
import { createCache } from './cache'
import type { Cache } from './cache/cache'

export const setVariables = (vars: () => {}) => setContext('variables', vars)
export const getVariables = (): (() => {}) => getContext('variables') || (() => ({}))
export const getCache = () => {
	const cache = getContext<Cache>('__houdini__cache__')

	if (!cache) {
		throw new Error(
			'Please invoke setCache() from $houdini inside of your entry point instance script e.g. (__layout.svelte, App.svelte)'
		)
	}

	return cache
}
export const setCache = () => setContext('__houdini__cache__', createCache())
