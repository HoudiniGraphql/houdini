import { setContext, getContext } from 'svelte'
import { createCache } from './cache'
import type { Cache } from './cache/cache'

export const setVariables = (vars: () => {}) => setContext('variables', vars)
export const getVariables = (): (() => {}) => getContext('variables') || (() => ({}))
export const getCache = () => getContext<Cache>('__houdini__cache__')
export const setCache = () => setContext('__houdini__cache__', createCache())
