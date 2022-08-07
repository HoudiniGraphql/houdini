import path from 'path'
import type { Plugin } from 'vite'

import { getConfig } from '../common'
import houdini from './plugin'
import schema from './schema'
import watch_and_run from './watch-and-run'

export default function ({ configPath }: { configPath?: string } = {}): Plugin[] {
	// we need some way for the graphql tag to detect that we are running on the server
	// so we don't get an error when importing.
	process.env.HOUDINI_PLUGIN = 'true'

	return [
		houdini(configPath),
		schema(configPath),
		watch_and_run([
			{
				name: 'Houdini',
				async watch() {
					// load the config file
					const config = await getConfig({ configFile: configPath })

					// the list of paths we want to watch for actions
					const paths = [config.sourceGlob, config.filepath, config.schemaPath]

					// join the list of paths in a minimatch pattern
					return paths
						.filter(Boolean)
						.map((filepath) => `(${path.resolve(filepath!)})`)
						.join('|')
				},
				run: 'npx houdini generate',
				delay: 100,
				watchKind: ['add', 'change', 'unlink'],
			},
		]),
	]
}
