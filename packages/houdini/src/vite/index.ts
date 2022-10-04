import minimatch from 'minimatch'
import path from 'path'
import type { Plugin } from 'vite'
import watch_and_run from 'vite-plugin-watch-and-run'

import generate from '../codegen'
import { getConfig, PluginConfig } from '../lib/config'
import { formatErrors } from '../lib/graphql'
import vite_adapter from './adapter'
import houdini from './plugin'
import schema from './schema'

export * from './ast'
export * from './imports'
export * from './schema'
export * from './plugin'

export default function (opts: PluginConfig): Plugin[] {
	// we need some way for the graphql tag to detect that we are running on the server
	// so we don't get an error when importing.
	process.env.HOUDINI_PLUGIN = 'true'

	return [
		houdini(opts),
		schema(opts),
		vite_adapter(opts),
		watch_and_run([
			{
				name: 'Houdini',
				quiet: true,
				async watchFile(filepath: string) {
					// load the config file
					const config = await getConfig(opts)

					// we need to watch some specific files
					const schemaPath = path.join(path.dirname(config.filepath), config.schemaPath!)
					if (minimatch(filepath, schemaPath)) {
						return true
					}

					return config.includeFile(filepath, process.cwd())
				},
				async run() {
					// load the config file
					const config = await getConfig(opts)

					// make sure we behave as if we're generating from inside the plugin (changes logging behavior)
					config.plugin = true

					// generate the runtime
					await generate(config)
				},
				delay: 100,
				watchKind: ['add', 'change', 'unlink'],
				formatErrors,
			},
		]),
	]
}
