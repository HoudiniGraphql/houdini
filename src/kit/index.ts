import minimatch from 'minimatch'
import type { Plugin } from 'vite'

import generate from '../cmd/generate'
import { getConfig } from '../common'
import { ConfigFile } from '../runtime'
import houdini from './plugin'
import schema from './schema'
import watch_and_run from './watch-and-run'

export default function ({
	configPath,
	...extraConfig
}: { configPath?: string } & Partial<ConfigFile> = {}): Plugin[] {
	// we need some way for the graphql tag to detect that we are running on the server
	// so we don't get an error when importing.
	process.env.HOUDINI_PLUGIN = 'true'

	return [
		houdini(configPath),
		schema(configPath),
		watch_and_run([
			{
				name: 'Houdini',
				quiet: true,
				async watchFile(filepath: string) {
					// load the config file
					const config = await getConfig({ configFile: configPath, ...extraConfig })

					// we need to watch some specific files
					if ([config.filepath, config.schemaPath].includes(filepath)) {
						return true
					}

					// if the filepath matches the include
					if (minimatch(filepath, config.include)) {
						// make sure that the file doesn't match the exclude
						return !config.exclude || !minimatch(filepath, config.exclude)
					}

					// if we got this far, we dont care about the filepath
					return false
				},
				async run() {
					// load the config file
					const config = await getConfig({ configFile: configPath, ...extraConfig })

					// make sure we behave as if we're generating from inside the plugin (changes logging behavior)
					config.plugin = true

					// generate the runtime
					await generate(config)
				},
				delay: 100,
				watchKind: ['add', 'change', 'unlink'],
			},
		]),
	]
}
