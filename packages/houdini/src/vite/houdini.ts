import path from 'node:path'
import type { Plugin as VitePlugin, ConfigEnv as ViteEnv, ResolvedConfig } from 'vite'

import type { VitePluginContext } from '.'
import { codegen_setup } from '../lib/codegen.js'
import * as fs from '../lib/fs.js'
import type { CompilerProxy } from '../lib/index.js'

let viteEnv: ViteEnv
let viteConfig: ResolvedConfig
let devServer = false

export let compiler: CompilerProxy
let alreadyBuilt = false

export function houdini(ctx: VitePluginContext): VitePlugin {
	return {
		name: 'houdini',

		enforce: 'pre',

		async configureServer() {
			devServer = true
		},

		async configResolved(conf) {
			if (!is_secondary_build()) {
				viteConfig = conf
			}
		},

		async config(userConfig, env) {
			viteEnv = env

			const runtimeDir = path.join(
				ctx.config.root_dir,
				ctx.config.config_file.runtimeDir ?? '.houdini'
			)
			// add the necessary values for the houdini imports to resolve
			return {
				resolve: {
					...userConfig.resolve,
					alias: {
						...userConfig.resolve?.alias,
						$houdini: runtimeDir,
						'$houdini/*': path.join(runtimeDir, '*'),
						'~': path.join(ctx.config.root_dir, 'src'),
						'~/*': path.join(ctx.config.root_dir, 'src', '*'),
					},
				},
				server: {
					...userConfig.server,
					fs: {
						...userConfig.server?.fs,
						allow: ['.'].concat(userConfig.server?.fs?.allow || []),
					},
				},
			}
		},

		// when the build starts, we need to make sure to generate
		async buildStart(args) {
			// and a proxy to talk to the compiler
			if (!compiler && !devServer) {
				compiler = await codegen_setup(ctx.config, 'dev', ctx.db, ctx.db_file)
			}

			// check if the adapter has a pre hook
			if (ctx.adapter?.pre && viteEnv.command === 'build' && !is_secondary_build()) {
				const routerConventions = await import('../router/conventions.js')
				await ctx.adapter.pre({
					config: ctx.config,
					conventions: routerConventions,
					sourceDir: viteConfig.build.outDir,
					publicBase: viteConfig.base,
					outDir: routerConventions.router_build_directory(ctx.config),
				})
			}

			// we need to generate the runtime if we are building in production
			if (
				!devServer &&
				!is_secondary_build() &&
				!process.env.HOUDINI_SKIP_GENERATE &&
				!alreadyBuilt
			) {
				// run the codegen
				await compiler.run_pipeline({
					// the pipeline through schema is run as part of codegen_setup
					after: 'Schema',
				})

				// make sure we don't build twice
				alreadyBuilt = true

				await compiler.close()
			}
		},

		async closeBundle() {
			if (is_secondary_build() || viteEnv.mode !== 'production' || devServer) {
				return
			}

			// if we dont' have an adapter, we don't need to do anything
			if (!ctx.adapter) {
				return
			}

			// dry
			const routerConventions = await import('../router/conventions.js')
			const outDir = routerConventions.router_build_directory(ctx.config)
			const sourceDir = viteConfig.build.outDir

			// tell the user what we're doing
			console.log('🎩 Generating Deployment Assets...')

			// before we can invoke the adpater we need to ensure the build directory is present
			try {
				const stat = await fs.stat(outDir)
				if (stat?.isDirectory()) {
					await fs.rmdir(outDir)
				}
			} catch {}
			await fs.mkdirp(outDir)

			// load the project manifest
			const { load_manifest } = await import('../router/manifest.js')
			const manifest = await load_manifest({
				config: ctx.config,
				includeArtifacts: true,
			})

			// before we load the adapter we want to do some manual prep on the directories
			// pull the ssr directory out of assets (if applicable)
			if (!ctx.adapter?.disableServer) {
				await fs.recursiveCopy(path.join(sourceDir, 'ssr'), path.join(outDir, 'ssr'))
				await fs.rmdir(path.join(sourceDir, 'ssr'))
			}
			// copy the asset directory into the build directory
			await fs.recursiveCopy(sourceDir, path.join(outDir, 'assets'))

			// invoke the adapter
			await ctx.adapter({
				config: ctx.config,
				conventions: routerConventions,
				sourceDir,
				publicBase: viteConfig.base,
				outDir,
				manifest,
				adapterPath: './ssr/entries/adapter',
			})

			// if there is a public directory at the root of the project,
			if (fs.existsSync(path.join(ctx.config.root_dir, 'public'))) {
				// copy the contents of the directory into the build directory
				await fs.recursiveCopy(path.join(ctx.config.root_dir, 'public'), outDir)
			}
		},
	}
}

function is_secondary_build() {
	return false
}
