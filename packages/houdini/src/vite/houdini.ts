import type { UserConfig, Plugin as VitePlugin } from "vite"

import type { VitePluginContext } from '.'

export function houdini(ctx: VitePluginContext): VitePlugin {
	return {
		name: "houdini",

		enforce: "pre",

		async config(userConfig) {
			// add the necessary values for the houdini imports to resolve
			const result: UserConfig = {
				server: {
					...userConfig.server,
					fs: {
						...userConfig.server?.fs,
						allow: ["."].concat(userConfig.server?.fs?.allow || []),
					},
				},
			}

			// we're done
			return result
		},
	}
}
