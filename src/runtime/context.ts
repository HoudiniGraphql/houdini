// @ts-ignore
import { getPage, getSession } from './adapter.mjs'
import { setContext, getContext } from 'svelte'
import { HoudiniClientContext } from './index.js'

export const setVariables = (vars: () => {}) => setContext('variables', vars)

export const getHoudiniClientContext = (): HoudiniClientContext => {
	return {
		page: getPage(),
		session: getSession(),
		variables: getContext('variables') || (() => ({})),
	}
}
