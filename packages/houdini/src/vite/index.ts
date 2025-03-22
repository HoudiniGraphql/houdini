import type { Plugin } from 'vite'

import type { PluginConfig } from '../lib'
import houdini_vite from './houdini'
import { watch_local_schema, watch_remote_schema } from './schema'

export * from './ast'
export * from './imports'
export * from './schema'
export * from './houdini'

export default function (opts?: PluginConfig): (Plugin | null)[] {
	// we need some way for the graphql tag to detect that we are running on the server
	// so we don't get an error when importing.
	process.env.HOUDINI_PLUGIN = 'true'

	// a container of a list
	const watchSchemaListref = { list: [] as string[] }

	return [
		houdini_vite(opts, watchSchemaListref),
		watch_remote_schema(opts),
		watch_local_schema(watchSchemaListref),
	]
}
