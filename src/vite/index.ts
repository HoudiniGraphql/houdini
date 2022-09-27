import minimatch from 'minimatch'
import path from 'path'
import type { Plugin } from 'vite'
import watch_and_run from 'vite-plugin-watch-and-run'

import generate from '../cmd/generate'
import { formatErrors, getConfig } from '../common'
import { ConfigFile } from '../runtime'
import fs_patch from './fsPatch'
import houdini from './plugin'
import schema from './schema'

export default function ({
	configPath,
	...extraConfig
}: { configPath?: string } & Partial<ConfigFile> = {}): Plugin[] {
	// we need some way for the graphql tag to detect that we are running on the server
	// so we don't get an error when importing.
	process.env.HOUDINI_PLUGIN = 'true'

	return [
		houdini(configPath),
		schema({ configFile: configPath, ...extraConfig }),
		fs_patch(configPath),
		watch_and_run([
			{
				name: 'Houdini',
				quiet: true,
				async watchFile(filepath: string) {
					// load the config file
					const config = await getConfig({ configFile: configPath, ...extraConfig })

					// we need to watch some specific files
					const schemaPath = path.join(path.dirname(config.filepath), config.schemaPath!)
					if (minimatch(filepath, schemaPath)) {
						return true
					}

					// if the filepath does match the include, but does match exclude, ignore it
					if (config.include.some((pattern) => minimatch(filepath, pattern))) {
						if (!config.exclude?.some((pattern) => minimatch(filepath, pattern))) {
							return false
						}
					}

					return true
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
				formatErrors,
			},
		]),
	]
}
