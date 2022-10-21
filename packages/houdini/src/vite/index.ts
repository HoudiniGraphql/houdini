import minimatch from 'minimatch'
import type { Plugin } from 'vite'
import watch_and_run from 'vite-plugin-watch-and-run'

import generate from '../codegen'
import { getConfig, PluginConfig, formatErrors, path } from '../lib'
import houdini_vite from './houdini'
import watch_remote_schema from './schema'

export * from './ast'
export * from './imports'
export * from './schema'
export * from './houdini'

export default function (opts?: PluginConfig): Plugin[] {
	// we need some way for the graphql tag to detect that we are running on the server
	// so we don't get an error when importing.
	process.env.HOUDINI_PLUGIN = 'true'

	return [
		houdini_vite(opts),
		watch_remote_schema(opts),
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

					return config.includeFile(filepath, { root: process.cwd() })
				},
				async run() {
					// load the config file
					const config = await getConfig(opts)

					// make sure we behave as if we're generating from inside the plugin (changes logging behavior)
					config.pluginMode = true

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
