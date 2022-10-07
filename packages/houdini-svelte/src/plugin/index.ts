import { HoudiniError, PluginFactory } from 'houdini'
import path from 'path'

import generate from './codegen'
import extract from './extract'
import fs_patch from './fsPatch'
import { global_store_name, resolve_relative, stores_directory, store_name } from './kit'
import apply_transforms from './transforms'
import validate from './validate'

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
	generate,

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
	transform_file: apply_transforms,

	include(config, filepath) {
		// the files we generate contain some crazy relative paths that we need to make sure we include for transformations
		// fix the include path and try again
		return config.includeFile(resolve_relative(config, filepath), { ignore_plugins: true })
	},

	// add custom vite config
	vite: {
		...fs_patch,
	},

	/**
	 * Setup
	 */

	// Check that storeName & globalStoreName are not overlapping.
	// Not possible today, but maybe in the future if storeName starts to be configurable.
	async after_load(config) {
		if (
			store_name({ config, name: 'QueryName' }) ===
			global_store_name({ config, name: 'QueryName' })
		) {
			throw new HoudiniError({
				filepath: config.filepath,
				message: 'Invalid config file: "globalStoreName" and "storeName" are overlapping',
				description: `Here, both gives: ${store_name({ config, name: 'QueryName' })}`,
			})
		}
	},
})

export default HoudiniSveltePlugin
