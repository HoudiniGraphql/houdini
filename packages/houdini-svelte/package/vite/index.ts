import { VitePluginContext } from 'houdini/vite'
import { PluginOption } from 'vite'
import { path } from 'houdini'

import transform_file from './transform/index.js'

export default function (ctx: VitePluginContext): PluginOption {
	return {
		name: 'houdini-svelte',
    transform(code: string, filepath: string) {
			// everything internal to houdini should assume posix paths
			filepath = path.posixify(filepath)

			if (filepath.startsWith('/src/')) {
				filepath = path.join(process.cwd(), filepath)
			}

      // apply the transforms
      return transform_file('kit', {
        config: ctx.config,
        content: code,
        filepath,
				watch_file: this.addWatchFile.bind(this),
				map: this.getCombinedSourcemap(),
      })
    }
	}
}


