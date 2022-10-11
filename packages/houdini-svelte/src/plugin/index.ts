import { HoudiniError, PluginFactory } from 'houdini'
import path from 'path'

import generate from './codegen'
import extract from './extract'
import fs_patch from './fsPatch'
import {
	global_store_name,
	resolve_relative,
	stores_directory,
	store_name,
	type Framework,
} from './kit'
import apply_transforms from './transforms'
import validate from './validate'

let framework: Framework = 'svelte'

const HoudiniSveltePlugin: PluginFactory = async () => ({
	/**
	 * Generate
	 */

	extensions: ['.svelte'],

	// custom logic to pull a graphql document out of a svelte file
	extract_documents: extract,

	// we have some custom document validation logic
	validate,

	// we need to write the svelte specific runtime
	generate(input) {
		return generate({
			...input,
			framework,
		})
	},

	// we need to add the exports to the index files (this one file processes index.js and index.d.ts)
	index_file({ config, content, export_star_from, plugin_root }) {
		const storesDir =
			'./' +
			path.relative(config.rootDir, stores_directory(plugin_root)).split(path.sep).join('/')

		return content + export_star_from({ module: storesDir })
	},

	/**
	 * Transform
	 */

	// transform a file's contents. changes here aren't seen by extract_documents
	transform_file(page) {
		return apply_transforms(framework, page)
	},

	include(config, filepath) {
		// the files we generate contain some crazy relative paths that we need to make sure we include for transformations
		// fix the include path and try again
		return config.includeFile(resolve_relative(config, filepath), { ignore_plugins: true })
	},

	// add custom vite config
	vite: {
		...fs_patch(() => framework),
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

		if (!cfg.configFile.plugins?.['houdini-svelte'].client) {
			throw new HoudiniError({
				filepath: cfg.filepath,
				message: 'Invalid config file: missing client value.',
				description:
					'Please set it to the relative path (from houdini.config.js) to your client file. The file must have a default export with an instance of HoudiniClient.',
			})
		}

		// try to import the kit module
		try {
			await import('@sveltejs/kit')
			framework = 'kit'
		} catch {}
	},
})

export default HoudiniSveltePlugin

declare module 'houdini' {
	interface HoudiniPluginConfig {
		'houdini-svelte': HoudiniVitePluginConfig
	}
}

export type HoudiniVitePluginConfig = {
	/**
	 * A relative path from your houdini.config.js to the file that exports your client as its default value
	 */
	client: string

	/**
	 * The name of the file used to define page queries.
	 * @default +page.gql
	 */
	pageQueryFilename?: string

	/**
	 * The default prefix of your global stores.
	 *
	 * _Note: it's nice to have a prefix so that your editor finds all your stores by just typings this prefix_
	 * @default GQL_
	 */
	globalStorePrefix?: string

	/**
	 * With this enabled, errors in your query will not be thrown as exceptions. You will have to handle
	 * error state in your route components or by hand in your load (or the onError hook)
	 */
	quietQueryErrors?: boolean

	/**
	 * A flag to treat every component as a non-route. This is useful for projects built with the static-adapter
	 */
	static?: boolean
}
