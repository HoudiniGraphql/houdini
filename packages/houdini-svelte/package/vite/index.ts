import { path } from 'houdini'
import { VitePluginContext } from 'houdini/vite'
import { PluginOption } from 'vite'

import transform_file from './transform/index.js'

export default function (ctx: VitePluginContext): PluginOption {
	return {
		name: 'houdini-svelte',
		enforce: 'pre',
		async transform(code: string, filepath: string) {
			// everything internal to houdini should assume posix paths
			filepath = path.posixify(filepath)

			if (filepath.startsWith('/src/')) {
				filepath = path.join(process.cwd(), filepath)
			}

			// if the file is not in our configured source path, we need to ignore it
			if (!ctx.config.includeFile(filepath)) {
				return
			}

			// everything internal to houdini should assume posix paths
			filepath = path.posixify(filepath)

			if (filepath.startsWith('/src/')) {
				filepath = path.join(process.cwd(), filepath)
			}

			// apply the transforms
			const result = await transform_file('kit', {
				config: ctx.config,
				content: code,
				filepath,
				watch_file: this.addWatchFile.bind(this),
				map: this.getCombinedSourcemap(),
			})

			return result
		},
	}
}
