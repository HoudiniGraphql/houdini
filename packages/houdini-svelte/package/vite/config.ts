import { Config } from 'houdini'
import type { HoudiniSvelteConfig } from 'houdini-svelte'

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
			queryCursor: '../runtime/stores/query.QueryStoreCursor',
			queryOffset: '../runtime/stores/query.QueryStoreOffset',
			fragmentCursor: '../runtime/stores/fragment.FragmentStoreCursor',
			fragmentOffset: '../runtime/stores/fragment.FragmentStoreOffset',
			...cfg?.customStores,
		},
	}
}
