import { Config } from 'houdini'
import { VitePluginContext } from 'houdini/vite'
import { PluginOption } from 'vite'
import transform_file from './transform'
import { path } from 'houdini'
import type { HoudiniSvelteConfig } from 'houdini-svelte'

export default function (ctx: VitePluginContext): PluginOption {
	return {
		name: 'houdini-react',
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

export function plugin_config(config: Config): Required<HoudiniSvelteConfig> {
	const cfg = config.pluginConfig<HoudiniSvelteConfig>('houdini-svelte')

	return {
		client: './src/client',
		defaultRouteBlocking: false,
		static: false,
		forceRunesMode: false,
    framework: 'kit',
		...cfg,
		customStores: {
			query: '../runtime/stores/query.QueryStore',
			mutation: '../runtime/stores/mutation.MutationStore',
			fragment: '../runtime/stores/fragment.FragmentStore',
			subscription: '../runtime/stores/subscription.SubscriptionStore',
			queryCursor: '../runtime/stores/pagination/query.QueryStoreCursor',
			queryOffset: '../runtime/stores/pagination/query.QueryStoreOffset',
			fragmentCursor: '../runtime/stores/pagination/fragment.FragmentStoreCursor',
			fragmentOffset: '../runtime/stores/pagination/fragment.FragmentStoreOffset',
			...cfg?.customStores,
		},
	}
}

