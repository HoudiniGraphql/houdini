import type { Plugin } from 'vite'
import watchAndRun from '@kitql/vite-plugin-watch-and-run'
import path from 'path'
import { getConfig } from '../common'

export type HoudiniPluginConfig = {
	configPath?: string
}

export default function ({ configPath }: HoudiniPluginConfig): Plugin {
	return {
		name: 'houdini',

		// add watch-and-run to their vite config
		async config(viteConfig, { command }) {
			const config = await getConfig({ configFile: configPath })

			// we know plugins isn't null because this is a plugin
			viteConfig.plugins!.push(
				watchAndRun([
					{
						name: 'Houdini',
						watch: path.resolve(config.sourceGlob),
						run: 'npm run generate',
						delay: 100,
						watchKind: ['ready', 'add', 'change', 'unlink'],
					},
					{
						name: 'Houdini',
						watch: path.resolve(config.filepath),
						run: 'npm run generate',
						delay: 100,
					},
				])
			)

			// also add the fs allow so we can import from the project rool
			viteConfig.server = {
				...viteConfig.server,
				fs: {
					...viteConfig.server?.fs,
					allow: ['.'].concat(viteConfig.server?.fs?.allow || []),
				},
			}
		},

		//
	}
}
