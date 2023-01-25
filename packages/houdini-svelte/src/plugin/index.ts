import type { PluginFactory } from 'houdini'
import { HoudiniError, path, fs, type Config } from 'houdini'
import * as url from 'url'
import { loadEnv } from 'vite'

import { artifactData } from './artifactData'
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

		[path.join('imports', 'client.js')]: ({ config: cfg }) => {
			const config = plugin_config(cfg)
			// the path to the network file
			const networkFilePath = path.join(
				cfg.pluginRuntimeDirectory('houdini-svelte'),
				'imports',
				'clientImport.js'
			)
			// the relative path
			const relativePath = path.relative(
				path.dirname(networkFilePath),
				path.join(cfg.projectRoot, config.client ?? 'src/client')
			)
			return `import client from "${relativePath}"

export default client
`
		},
	},

	// add custom artifact data to the artifact document
	artifact_data: artifactData,

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
		const cfgPlugin = plugin_config(cfg)

		let client_file_exists = false
		// if there is an extension in then we can just check that file
		if (path.extname(cfgPlugin.client)) {
			client_file_exists = !!(await fs.readFile(cfgPlugin.client))
		}
		// there is no extension so we to check .ts and .js versions
		else {
			client_file_exists = (
				await Promise.all([
					fs.readFile(cfgPlugin.client + '.ts'),
					fs.readFile(cfgPlugin.client + '.js'),
				])
			).some(Boolean)
		}
		if (!client_file_exists) {
			throw new HoudiniError({
				filepath: cfgPlugin.client,
				message: `File "${cfgPlugin.client}.(ts,js)" is missing. Either create it or set the client property in houdini.config.js file to target your houdini client file.`,
				description:
					'It has to be a relative path (from houdini.config.js) to your client file. The file must have a default export with an instance of HoudiniClient.',
			})
		}

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
	 * A relative path from your houdini.config.js to the file that exports your client as its default value
	 * @default `./src/client.ts`
	 */
	client?: string

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
		queryCursor?: string
		queryOffset?: string
		fragmentCursor?: string
		fragmentOffset?: string
	}
}
