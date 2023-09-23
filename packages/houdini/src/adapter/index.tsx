import type { serverAdapterFactory as createAdapter } from '../runtime/router/server'

export let createServerAdapter: (
	args: Omit<
		Parameters<typeof createAdapter>[0],
		'on_render' | 'manifest' | 'yoga' | 'schema' | 'graphqlEndpoint'
	>
) => ReturnType<typeof createAdapter>
