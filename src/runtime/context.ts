// @ts-ignore
import { getPage, getSession } from './adapter.mjs'
import { setContext, getContext } from 'svelte'

export const setVariables = (vars: () => {}) => setContext('variables', vars)

export const context = () => {
	return {
		page: getPage(),
		session: getSession(),
		variables: getContext('variables') || (() => ({})),
	}
}
