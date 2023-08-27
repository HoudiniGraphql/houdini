import type { Config, PluginHooks } from 'houdini'
import { HoudiniError, detectFromPackageJSON, fs, path, plugin } from 'houdini'
import * as url from 'node:url'
import { loadEnv } from 'vite'

import { artifactData } from './artifactData'
import generate from './codegen'
import extract from './extract'
import fs_patch from './fsPatch'
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
	 * Config
	 */
	order: 'core',

	/**
	 * Generate
	 */

	extensions: ['.svelte'],

	includeRuntime: {
		esm: '../runtime-esm',
		commonjs: '../runtime-cjs',
	},

	transformRuntime: {
		'adapter.js': ({ content }) => {
			// dedicated sveltekit adapter.
			const sveltekit_adapter = `import { browser, building } from '$app/environment'
import { error as svelteKitError, redirect as svelteKitRedirect } from '@sveltejs/kit'

export const isBrowser = browser

export let clientStarted = false;

export function setClientStarted() {
	clientStarted = true
}

export const isPrerender = building

export const error = svelteKitError
export const redirect = svelteKitRedirect
`

			return framework === 'kit' ? sveltekit_adapter : content
		},

		'client.js': ({ config, content }) => {
			// the path to the network file
			const networkFilePath = path.join(
				config.pluginRuntimeDirectory('houdini-svelte'),
				'network.js'
			)
			// the relative path
			const relativePath = path.relative(
				path.dirname(networkFilePath),
				path.join(config.projectRoot, plugin_config(config).client)
			)

			return content.replace('HOUDINI_CLIENT_PATH', relativePath)
		},
	},

	// add custom artifact data to the artifact document
	artifactData: artifactData,

	// custom logic to pull a graphql document out of a svelte file
	extractDocuments: extract,

	schema({ config }) {
		return `
"""
	@${config.loadDirective} is used to enable automatic fetch on inline queries.
"""
directive @${config.loadDirective} on QUERY

"""
	@${config.blockingDirective} is used to always await the fetch.
"""
directive @${config.blockingDirective} on QUERY

"""
	@${config.blockingDisableDirective} is used to not always await the fetch (in CSR for example). Note that "throwOnError" will not throw in this case.
"""
directive @${config.blockingDisableDirective} on QUERY
`
	},

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
				}).replaceAll('$houdini', '..'),
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

	// add custom vite config
	vite: {
		...fs_patch(() => framework),
	},

	/**
	 * Setup
	 */

	async afterLoad({ config: cfg }) {
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

		// if it's specified in the config then use that hardcoded value
		if (cfgPlugin.framework) {
			framework = cfgPlugin.framework
		} else {
			// detect if we are in a svelte or sveltekit project
			const detected = await detectFromPackageJSON(cfg.projectRoot)
			framework = detected.frameworkInfo.framework === 'kit' ? 'kit' : 'svelte'
		}
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

export default plugin('houdini-svelte', pluginHooks)

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
	 * Specifies whether the client side routing is blocking or not. (default: `false`)
	 */
	defaultRouteBlocking?: boolean

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
	 * set the framework to use. It should be automatically detected but you can override it here.
	 * @default undefined
	 */
	framework: 'kit' | 'svelte' | undefined

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
