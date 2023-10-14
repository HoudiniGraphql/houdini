import type { SourceMapInput } from 'rollup'
import type { Plugin as VitePlugin, UserConfig, ResolvedConfig, ConfigEnv } from 'vite'

import generate from '../codegen'
import type { Config, PluginConfig } from '../lib'
import {
	path,
	getConfig,
	formatErrors,
	fs,
	deepMerge,
	routerConventions,
	load_manifest,
	loadLocalSchema,
	isSecondaryBuild,
} from '../lib'

let config: Config
let viteConfig: ResolvedConfig
let viteEnv: ConfigEnv
let devServer = false

export default function Plugin(opts: PluginConfig = {}): VitePlugin {
	return {
		name: 'houdini',

		// houdini will always act as a "meta framework" and process the user's code before it
		// is processed by the user's library-specific plugins.
		enforce: 'pre',

		// add watch-and-run to their vite config
		async config(userConfig, env) {
			config = await getConfig(opts)
			viteEnv = env

			let result: UserConfig = {
				server: {
					...userConfig.server,
					fs: {
						...userConfig.server?.fs,
						allow: ['.'].concat(userConfig.server?.fs?.allow || []),
					},
				},
			}

			// plugins might want to override values
			for (const plugin of config.plugins) {
				if (typeof plugin.vite?.config !== 'function') {
					continue
				}
				result = deepMerge('', result, await plugin.vite!.config.call(this, config, env))
			}

			return result
		},

		async buildEnd(args) {
			for (const plugin of config.plugins) {
				if (typeof plugin.vite?.buildEnd !== 'function') {
					continue
				}

				await plugin.vite!.buildEnd.call(this, args, config)
			}
		},

		async configResolved(conf) {
			if (!isSecondaryBuild()) {
				viteConfig = conf
			}
			for (const plugin of config.plugins) {
				if (typeof plugin.vite?.configResolved !== 'function') {
					continue
				}

				await plugin.vite!.configResolved.call(this, conf)
			}
		},

		// called when all of the bundles have been generated (ie, when vite is done)
		// we use this to generate the final assets needed for a production build of the server.
		// this is only called when bundling (ie, not in dev mode)
		async closeBundle() {
			if (isSecondaryBuild() || viteEnv.mode !== 'production' || devServer) {
				return
			}

			for (const plugin of config.plugins) {
				if (typeof plugin.vite?.closeBundle !== 'function') {
					continue
				}

				await plugin.vite!.closeBundle.call(this, config)
			}

			// if we dont' have an adapter, we don't need to do anything
			if (!opts.adapter) {
				return
			}

			// dry
			const outDir = config.routerBuildDirectory
			const sourceDir = viteConfig.build.outDir

			// tell the user what we're doing
			console.log('🎩 Generating Deployment Assets...')

			// before we can invoke the adpater we need to ensure the build directory is present
			try {
				const stat = await fs.stat(config.routerBuildDirectory)
				if (stat?.isDirectory()) {
					await fs.rmdir(config.routerBuildDirectory)
				}
			} catch {}
			await fs.mkdirp(config.routerBuildDirectory)

			// load the project manifest
			const manifest = await load_manifest({ config, includeArtifacts: true })

			// before we load the adapter we want to do some manual prep on the directories
			// pull the ssr directory out of assets
			await fs.recursiveCopy(path.join(sourceDir, 'ssr'), path.join(outDir, 'ssr'))
			await fs.rmdir(path.join(sourceDir, 'ssr'))

			// copy the asset directory into the build directory
			await fs.recursiveCopy(sourceDir, path.join(outDir, 'assets'))

			// invoke the adapter
			await opts.adapter({
				config,
				conventions: routerConventions,
				sourceDir,
				publicBase: viteConfig.base,
				outDir,
				manifest,
				adapterPath: './ssr/entries/adapter',
			})

			// if there is a public directory at the root of the project,
			if (fs.existsSync(path.join(config.projectRoot, 'public'))) {
				// copy the contents of the directory into the build directory
				await fs.recursiveCopy(
					path.join(config.projectRoot, 'public'),
					viteConfig.build.outDir
				)
			}
		},

		// when the build starts, we need to make sure to generate
		async buildStart(args) {
			for (const plugin of config.plugins) {
				if (typeof plugin.vite?.buildStart !== 'function') {
					continue
				}

				// @ts-expect-error
				await plugin.vite!.buildStart.call(this, {
					...args,
					houdiniConfig: config,
				})
			}

			// we need to generate the runtime if we are building in production
			if (!devServer && !isSecondaryBuild()) {
				// make sure we have an up-to-date schema
				if (config.localSchema && !config.schema) {
					config.schema = await loadLocalSchema(config)
				}

				// run the codegen
				try {
					await generate(config)
				} catch (e) {
					formatErrors(e)
					throw e
				}
			}
		},

		options(options) {
			for (const plugin of config.plugins) {
				if (typeof plugin.vite?.options !== 'function') {
					continue
				}

				// @ts-expect-error
				options = plugin.vite!.options.call(this, {
					...options,
					houdiniConfig: config,
				})
			}

			return Object.fromEntries(
				Object.entries(options).filter(([key]) => key !== 'houdiniConfig')
			)
		},

		async configureServer(server) {
			devServer = true

			for (const plugin of config.plugins) {
				if (typeof plugin.vite?.configureServer !== 'function') {
					continue
				}

				await plugin.vite!.configureServer.call(this, {
					...server,
					houdiniConfig: config,
				})
			}

			// if there is a local schema we need to use that when generating
			if (config.localSchema && !config.schema) {
				config.schema = await loadLocalSchema(config)
			}

			process.env.HOUDINI_PORT = String(server.config.server.port ?? 5173)

			try {
				await generate(config)
			} catch (e) {
				formatErrors(e)
				throw e
			}
		},

		// transform the user's code
		async transform(code, filepath) {
			// everything internal to houdini should assume posix paths
			filepath = path.posixify(filepath)

			if (filepath.startsWith('/src/')) {
				filepath = path.join(process.cwd(), filepath)
			}

			// if the file is not in our configured source path, we need to ignore it
			if (!config.includeFile(filepath)) {
				return
			}

			// bundle up the contextual stuff
			const ctx: TransformPage = {
				content: code,
				watch_file: this.addWatchFile,
				config: config,
				filepath,
				// @ts-ignore
				map: this.getCombinedSourcemap(),
			}

			// run the plugin pipeline
			for (const plugin of config.plugins) {
				if (!plugin.transformFile) {
					continue
				}
				const { code, map } = await plugin.transformFile(ctx)
				ctx.content = code
				ctx.map = map
			}

			return { code: ctx.content, map: ctx.map }
		},

		async load(id, opts, ...rest) {
			for (const plugin of config.plugins) {
				if (typeof plugin.vite?.load !== 'function') {
					continue
				}

				const result = await plugin.vite!.load.call(this, id, { ...opts, config }, ...rest)
				if (result) {
					return result
				}
			}
		},

		async resolveId(id, two, opts, ...rest) {
			for (const plugin of config.plugins) {
				if (typeof plugin.vite?.resolveId !== 'function') {
					continue
				}

				const result = await plugin.vite!.resolveId.call(
					this,
					id,
					two,
					{ ...opts, config },
					...rest
				)
				if (result) {
					return result
				}
			}
		},
	}
}

export interface TransformPage {
	config: Config
	content: string
	map?: SourceMapInput
	filepath: string
	watch_file: (path: string) => void
}
