import path from 'node:path'
import type { Plugin as VitePlugin, UserConfig } from 'vite'

import type { VitePluginContext } from '.'

export function houdini(ctx: VitePluginContext): VitePlugin {
	return {
		name: 'houdini',

		enforce: 'pre',

		async config(userConfig) {
			const runtimeDir = path.join(
				ctx.config.root_dir,
				ctx.config.config_file.runtimeDir ?? '.houdini'
			)
			// add the necessary values for the houdini imports to resolve
			return {
				resolve: {
					...userConfig.resolve,
					alias: {
						...userConfig.resolve?.alias,
						$houdini: runtimeDir,
						'$houdini/*': path.join(runtimeDir, '*'),
						'~': path.join(ctx.config.root_dir, 'src'),
						'~/*': path.join(ctx.config.root_dir, 'src', '*'),
					},
				},
				server: {
					...userConfig.server,
					fs: {
						...userConfig.server?.fs,
						allow: ['.'].concat(userConfig.server?.fs?.allow || []),
					},
				},
			}
		},
	}
}
