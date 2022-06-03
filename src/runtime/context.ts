// external imports
import { setContext, getContext as svelteContext } from 'svelte'
import { readable } from 'svelte/store'
// local imports
import { LoadContext } from './types'
// @ts-ignore
import { getPage, getSession } from './adapter.mjs'

export const setVariables = (vars: () => {}) => setContext('variables', vars)

export const getContext = (): LoadContext => {
	const session = getSession()
	return {
		page: getPage(),
		session: session.subscribe ? session : readable(session),
		variables: svelteContext('variables') || (() => ({})),
	}
}
