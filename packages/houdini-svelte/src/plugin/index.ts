import { HoudiniError, PluginFactory, path, fs, type Config } from 'houdini'
import * as url from 'url'
import { loadEnv } from 'vite'

import generate from './codegen'
import extract from './extract'
import fs_patch from './fsPatch'
import {
	plugin_config,
	resolve_relative,
	stores_directory,
	store_name,
	store_import_path,
	type Framework,
} from './kit'
import apply_transforms from './transforms'
import validate from './validate'

let framework: Framework = 'svelte'

export let _config: Config

const HoudiniSveltePlugin: PluginFactory = async () => ({
	order: 'core',

	/**
	 * Generate
	 */

	extensions: ['.svelte'],

	transform_runtime: {
		'adapter.js': ({ content }) => {
			// dedicated sveltekit adapter.
			const sveltekit_adapter = `import { browser, building } from '$app/environment'
import { error as svelteKitError } from '@sveltejs/kit'

export const isBrowser = browser

export let clientStarted = false;

export function setClientStarted() {
	clientStarted = true
}

export const isPrerender = building

export const error = svelteKitError
`

			return framework === 'kit' ? sveltekit_adapter : content
		},
	},

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

	graphql_tag_return({ config, doc, ensure_import }) {
		// if we're supposed to generate a store then add an overloaded declaration
		if (doc.generateStore) {
			// make sure we are importing the store
			const store = store_name({ config, name: doc.name })
			ensure_import({
				identifier: store,
				module: store_import_path({
					config,
					name: doc.name,
				}).replaceAll('$houdini', '..'),
			})

			// and use the store as the return value
			return store
		}
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

	async after_load(cfg) {
		_config = cfg

		// try to import the kit module
		try {
			await import('@sveltejs/kit')
			framework = 'kit'
		} catch {}
	},

	async env({ config }) {
		if (_env) {
			return _env
		}

		// the first thing we have to do is load the sveltekit config file
		const config_file = path.join(config.projectRoot, 'svelte.config.js')

		// load the SvelteKit config file
		let svelte_kit_cfg: Record<string, Record<string, string>> = {}
		try {
			svelte_kit_cfg = !fs.existsSync(config_file)
				? {}
				: await import(`${url.pathToFileURL(config_file).href}?ts=${Date.now()}`)
		} catch {}

		// load the vite config
		_env = loadEnv('dev', svelte_kit_cfg.kit?.dir || '.', '')

		return _env
	},
})

let _env: Record<string, string>

export default HoudiniSveltePlugin

declare module 'houdini' {
	interface HoudiniPluginConfig {
		'houdini-svelte': HoudiniSvelteConfig
	}
}

export type HoudiniSvelteConfig = {
	/**
	 * The name of the file used to define page queries.
	 * @default +page.gql
	 */
	pageQueryFilename?: string

	/**
	 * The name of the file used to define layout queries.
	 * @default +layout.gql
	 */
	layoutQueryFilename?: string

	/**
	 * A flag to treat every component as a non-route. This is useful for projects built with the static-adapter
	 * @default false
	 */
	static?: boolean

	/**
	 * Override the classes used when building stores for documents. Values should take the form package.export
	 * For example, if you have a store exported from $lib/stores you should set the value to "$lib/stores.CustomStore".
	 */
	customStores?: {
		query?: string
		mutation?: string
		subscription?: string
		fragment?: string
		queryForwardsCursor?: string
		queryBackwardsCursor?: string
		queryOffset?: string
		fragmentForwardsCursor?: string
		fragmentBackwardsCursor?: string
		fragmentOffset?: string
	}
}
