import path from 'path'
import type { Plugin } from 'vite'

import generate from '../cmd/codegen'
import { formatErrors, getConfig } from '../lib'
import { ConfigFile } from '../runtime/lib'
import vite_adapter from './adapter'
import houdini from './plugin'
import schema from './schema'

export * from './ast'
export * from './imports'
export * from './schema'
export * from './plugin'

export default function ({
	configPath,
	...extraConfig
}: {
	configPath?: string
} & Partial<ConfigFile> = {}): Plugin[] {
	// we need some way for the graphql tag to detect that we are running on the server
	// so we don't get an error when importing.
	process.env.HOUDINI_PLUGIN = 'true'

	return [
		houdini(configPath),
		schema({ configFile: configPath, ...extraConfig }),
		vite_adapter(configPath),
		// watch_and_run([
		// 	{
		// 		name: 'Houdini',
		// 		quiet: true,
		// 		async watchFile(filepath: string) {
		// 			// load the config file
		// 			const config = await getConfig({ configFile: configPath, ...extraConfig })

		// 			// we need to watch some specific files
		// 			const schemaPath = path.join(path.dirname(config.filepath), config.schemaPath!)
		// 			if (minimatch(filepath, schemaPath)) {
		// 				return true
		// 			}

		// 			// if the filepath does not match the include, ignore it
		// 			if (!minimatch(filepath, path.join(process.cwd(), config.include))) {
		// 				return false
		// 			}

		// 			// make sure that the file doesn't match the exclude
		// 			return !config.exclude || !minimatch(filepath, config.exclude)
		// 		},
		// 		async run() {
		// 			// load the config file
		// 			const config = await getConfig({ configFile: configPath, ...extraConfig })

		// 			// make sure we behave as if we're generating from inside the plugin (changes logging behavior)
		// 			config.plugin = true

		// 			// generate the runtime
		// 			await generate(config)
		// 		},
		// 		delay: 100,
		// 		watchKind: ['add', 'change', 'unlink'],
		// 		formatErrors,
		// 	},
		// ]),
	]
}
