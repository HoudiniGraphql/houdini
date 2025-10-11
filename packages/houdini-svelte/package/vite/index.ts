import { VitePluginContext } from 'houdini/vite'
import { PluginOption } from 'vite'

export default function (ctx: VitePluginContext): PluginOption {
	return {
		name: 'houdini-react',
		configureServer(server) {
			console.log('greetings from svelte vite plugin')
		},
	}
}
