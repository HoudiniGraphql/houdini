import type { Config } from 'houdini'

export type HoudiniSvelteConfig = {
	/**
	 * A relative path from your houdini.config.js to the file that exports your client as its default value
	 * @default `./src/client.ts`
	 */
	client?: string

	/**
	 * Specifies whether the client side routing is blocking or not. (default: `false`)
	 */
	defaultRouteBlocking?: boolean

	/**
	 * A flag to treat every component as a non-route. This is useful for projects built with the static-adapter
	 * @default false
	 */
	static?: boolean

	/**
	 * set the framework to use. It should be automatically detected but you can override it here.
	 * @default undefined
	 */
	framework: 'kit' | 'svelte' | undefined

	/**
	 * Force Houdini to always use Runes under the hood. Set this to true if you are enabling Runes mode globally for your app.
	 * When disabled, Houdini will try to detect Runes and go into Runes mode if required.
	 * @default false
	 */
	forceRunesMode?: boolean

	/**
	 * Override the classes used when building stores for documents. Values should take the form package.export
	 * For example, if you have a store exported from $lib/stores you should set the value to "$lib/stores.CustomStore".
	 */
	customStores?: {
		query?: string
		mutation?: string
		subscription?: string
		fragment?: string
		queryCursor?: string
		queryOffset?: string
		fragmentCursor?: string
		fragmentOffset?: string
	}
}

export function plugin_config(config: Config): Required<HoudiniSvelteConfig> {
	const cfg = config.pluginConfig<HoudiniSvelteConfig>('houdini-svelte')

	return {
		client: './src/client',
		defaultRouteBlocking: false,
		static: false,
		forceRunesMode: false,
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
