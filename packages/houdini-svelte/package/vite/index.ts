import { VitePluginContext } from 'houdini/vite'
import { PluginOption } from 'vite'
import transform_file from './transform'

export default function (ctx: VitePluginContext): PluginOption {
	return {
		name: 'houdini-react',
		async configureServer(server) {
			console.log('greetings from svelte vite plugin')
		},
    transform(code, id) {
      return transform_file('kit', { code, id })
    }
	}
}
