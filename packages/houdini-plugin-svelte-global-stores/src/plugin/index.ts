import { plugin, type PluginHooks } from 'houdini'
import { HoudiniError, path } from 'houdini'

import { store_name } from '../../../houdini-svelte/src/plugin/kit'
import generate from './codegen'
import { global_stores_directory, global_store_name } from './kit'

export const pluginHooks: () => Promise<PluginHooks> = async () => ({
	/**
	 * Generate
	 */

	// we need to write the svelte specific runtime
	generate(input) {
		return generate({
			...input,
		})
	},

	// we need to add the exports to the index files (this one file processes index.js and index.d.ts)
	index_file({ config, content, export_star_from, plugin_root }) {
		const storesDir =
			'./' +
			path
				.relative(config.rootDir, global_stores_directory(plugin_root))
				.split(path.sep)
				.join('/')

		return content + export_star_from({ module: storesDir })
	},

	/**
	 * Setup
	 */

	// Check that storeName & globalStoreName are not overlapping.
	// Not possible today, but maybe in the future if storeName starts to be configurable.
	async after_load(cfg) {
		if (
			store_name({ config: cfg, name: 'QueryName' }) ===
			global_store_name({ config: cfg, name: 'QueryName' })
		) {
			throw new HoudiniError({
				filepath: cfg.filepath,
				message: 'Invalid cfg file: "globalStoreName" and "storeName" are overlapping',
				description: `Here, both gives: ${store_name({ config: cfg, name: 'QueryName' })}`,
			})
		}
	},
})

export default plugin('houdini-plugin-svelte-global-stores', pluginHooks)

declare module 'houdini' {
	interface HoudiniPluginConfig {
		'houdini-plugin-svelte-global-stores': HoudiniPluginSvelteGlobalStoresConfig
	}
}

export type HoudiniPluginSvelteGlobalStoresConfig = {
	/**
	 * The default prefix of your global stores.
	 *
	 * _Note: it's nice to have a prefix so that your editor finds all your stores by just typings this prefix_
	 * @default GQL_
	 */
	prefix?: string
}
