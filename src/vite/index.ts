import type { Plugin } from 'vite'
import houdini from './plugin'
import schema from './schema'

export default function ({ configPath }: { configPath?: string } = {}): Plugin[] {
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
