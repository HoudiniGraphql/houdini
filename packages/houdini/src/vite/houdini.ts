import path from 'node:path'
import type { Plugin as VitePlugin, ConfigEnv as ViteEnv, ResolvedConfig } from 'vite'

import type { VitePluginContext } from '.'
import { routerConventions, fs } from '../lib/index.js'
import { load_manifest } from '../lib/router/manifest.js'

let viteEnv: ViteEnv
let viteConfig: ResolvedConfig
let devServer = false

export function houdini(ctx: VitePluginContext): VitePlugin {
	return {
		name: 'houdini',

		enforce: 'pre',

		async configureServer() {
			console.log('configure server')
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
			console.log('build start')
			// check if the adapter has a pre hook
			if (ctx.adapter?.pre && viteEnv.command === 'build' && !is_secondary_build()) {
				await ctx.adapter.pre({
					config: ctx.config,
					conventions: routerConventions,
					sourceDir: viteConfig.build.outDir,
					publicBase: viteConfig.base,
					outDir: routerConventions.router_build_directory(ctx.config),
				})
			}

			// we need to generate the runtime if we are building in production
			if (!devServer && !is_secondary_build() && !process.env.HOUDINI_SKIP_GENERATE) {
				// run the codegen
				// await generate(config)
				console.log('generating...')
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
