import type { serverAdapterFactory as createAdapter } from '../runtime/router/server'

export const endpoint: string = ''

export let createServerAdapter: (
	args: Omit<
		Parameters<typeof createAdapter>[0],
		'on_render' | 'manifest' | 'yoga' | 'schema' | 'graphqlEndpoint' | 'client'
	>
) => ReturnType<typeof createAdapter>
