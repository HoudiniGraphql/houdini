import { VitePluginContext } from 'houdini/vite'
import { PluginOption } from 'vite'
import transform_file from './transform'
import { path } from 'houdini'

export default function (ctx: VitePluginContext): PluginOption {
	return {
		name: 'houdini-react',
		async configureServer(server) {
			console.log('greetings from svelte vite plugin')
		},
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
