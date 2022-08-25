import { getContext, setContext } from 'svelte'

export const setVariables = (vars: () => {}) => setContext('variables', vars)

export const getVariables = (): {} => getContext('variables')
