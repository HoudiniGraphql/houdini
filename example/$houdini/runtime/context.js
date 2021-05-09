import { setContext, getContext } from 'svelte';
export const setVariables = (vars) => setContext('variables', vars);
export const getVariables = () => getContext('variables') || (() => ({}));
