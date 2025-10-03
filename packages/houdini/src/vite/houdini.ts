import type { Plugin as VitePlugin, UserConfig } from 'vite'

import type { VitePluginContext } from '.'

export function houdini(ctx: VitePluginContext): VitePlugin {
	return {
		name: 'houdini',

		enforce: 'pre',

		async config(userConfig) {
			// add the necessary values for the houdini imports to resolve
			let result: UserConfig = {
				server: {
					...userConfig.server,
					fs: {
						...userConfig.server?.fs,
						allow: ['.'].concat(userConfig.server?.fs?.allow || []),
					},
				},
			}

			// we're done
			return result
		},
	}
}
