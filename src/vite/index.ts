import type { Plugin } from 'vite'
import watchAndRun from '@kitql/vite-plugin-watch-and-run'
import path from 'path'
import houdini from './plugin'

export type HoudiniPluginConfig = {
	configPath?: string
}

export default function (pluginConfig?: HoudiniPluginConfig): Plugin[] {
	return [
		houdini(pluginConfig),
		// watchAndRun([
		// 	{
		// 		name: 'Houdini',
		// 		// QUESTIONS: can we make these promises?
		// 		//            what happens when sourceGlob changes?
		// 		//            would it be possible to somehow tell watch and run that the houdini config is the source of truth for config?
		// 		watch: path.resolve(config.sourceGlob),
		// 		run: 'npm run generate',
		// 		delay: 100,
		// 		watchKind: ['ready', 'add', 'change', 'unlink'],
		// 	},
		// 	{
		// 		name: 'Houdini',
		// 		watch: path.resolve(config.filepath),
		// 		run: 'npm run generate',
		// 		delay: 100,
		// 	},
		// ]),
	]
}
