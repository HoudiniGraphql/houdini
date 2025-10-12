import type { Config, PluginHooks } from 'houdini'
import { HoudiniError, detectFromPackageJSON, fs, path, plugin } from 'houdini'
import * as url from 'node:url'
import { loadEnv } from 'vite'

import { artifactData } from './artifactData'
import generate from './codegen'
import {
	plugin_config,
	resolve_relative,
	store_import_path,
	store_name,
	stores_directory,
	type Framework,
} from './kit'
import apply_transforms from './transforms'
import { validate } from './validate'

let framework: Framework = 'svelte'

export let _config: Config

export const pluginHooks = async (): Promise<PluginHooks> => ({
	/**
	 * Generate
	 */

	extensions: ['.svelte'],


	// add custom artifact data to the artifact document
	artifactData: artifactData,


	// we have some custom document validation logic
	validate,

	// we need to write the svelte specific runtime
	generate(input) {
		return generate({
			...input,
			framework,
		})
	},

	graphqlTagReturn({ config, document: doc, ensureImport: ensure_import }) {
		// if we're supposed to generate a store then add an overloaded declaration
		if (doc.generateStore) {
			// make sure we are importing the store
			const store = store_name({ config, name: doc.name })
			ensure_import({
				identifier: store,
				module: store_import_path({
					config,
					name: doc.name,
				}).replaceAll('.houdini', '..'),
			})

			// and use the store as the return value
			return store
		}
	},

	// we need to add the exports to the index files (this one file processes index.js and index.d.ts)
	indexFile({ config, content, exportStarFrom, pluginRoot }) {
		const storesDir =
			'./' +
			path.relative(config.rootDir, stores_directory(pluginRoot)).split(path.sep).join('/')

		return content + exportStarFrom({ module: storesDir })
	},

	/**
	 * Transform
	 */

	// transform a file's contents. changes here aren't seen by extractDocuments
	transformFile(page) {
		return apply_transforms(framework, page)
	},

	include({ config, filepath }) {
		// the files we generate contain some crazy relative paths that we need to make sure we include for transformations
		// fix the include path and try again
		return config.includeFile(resolve_relative(config, filepath), { ignore_plugins: true })
	},

})


export default plugin('houdini-svelte', pluginHooks)

