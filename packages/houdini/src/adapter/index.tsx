import type { serverAdapterFactory as createAdapter } from '../router/server'

export const endpoint: string = ''

export let createServerAdapter: (
	args: Omit<
		Parameters<typeof createAdapter>[0],
		| 'on_render'
		| 'manifest'
		| 'yoga'
		| 'schema'
		| 'graphqlEndpoint'
		| 'componentCache'
		| 'client'
		| 'config_file'
	>,
) => ReturnType<typeof createAdapter>
