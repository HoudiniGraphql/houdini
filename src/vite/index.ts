import type { Plugin } from 'vite'

import houdini from './plugin'
import schema from './schema'

export default function ({ configPath }: { configPath?: string } = {}): Plugin[] {
	// we need some way for the graphql tag to detect that we are running on the server
	// so we don't get an error when importing.
	process.env.HOUDINI_PLUGIN = 'true'

	return [
		houdini(configPath),
		schema(configPath),
		// watch_and_run([
		// 	{
		// 		name: 'Houdini',
		// 		watch: path.resolve(config.sourceGlob),
		// 		run: 'npx houdini generate',
		// 		delay: 100,
		// 		watchKind: ['add', 'change', 'unlink'],
		// 	},
		// 	{
		// 		name: 'Houdini',
		// 		watch: path.resolve(config.filepath),
		// 		run: 'npx houdini generate',
		// 		delay: 100,
		// 	},
		// 	{
		// 		name: 'Houdini',
		// 		watch: path.resolve(config.schemaPath || ''),
		// 		run: 'npx houdini generate',
		// 		delay: 50,
		// 	},
		// ]),
	]
}
