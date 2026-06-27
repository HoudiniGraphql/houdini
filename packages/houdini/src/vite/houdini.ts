import path from 'node:path'
import type { ResolvedConfig, ConfigEnv as ViteEnv, Plugin as VitePlugin } from 'vite'

import type { VitePluginContext } from './index.js'
import { codegen_setup, init_db } from '../lib/codegen.js'
import * as fs from '../lib/fs.js'
import type { CompilerProxy } from '../lib/index.js'

export let compiler: CompilerProxy
let alreadyBuilt = false

export function houdini(ctx: VitePluginContext): VitePlugin {
	let viteEnv: ViteEnv
	let viteConfig: ResolvedConfig
	let devServer = false

	return {
		name: 'houdini',

		enforce: 'pre',

		async configureServer() {
			devServer = true
		},

		async configResolved(conf) {
			viteConfig = conf

			// Worker builds (vite `worker.plugins`) must not touch the orchestration DB. Codegen
			// is a project-global, run-once step done by the main build; a worker pipeline opening
			// a second connection that recreates the same SQLite file races the main build and
			// throws a disk I/O error (#1703). Workers skip the DB and codegen entirely.
			if (conf.isWorker) {
				return
			}

			// open the orchestration DB lazily (the plugin's default export no longer does this
			// eagerly, so that the worker check above can run first)
			if (!ctx.db) {
				const [db] = await init_db(ctx.config, false)
				ctx.db = db
			}
		},

		async config(userConfig, env) {
			viteEnv = env

			const runtimeDir = path.join(
				ctx.config.root_dir,
				ctx.config.config_file.runtimeDir ?? '.houdini'
			)

			// add the necessary values for the houdini imports to resolve
			// In vite 8 the aliases can be an object or an array of objects,
			// so we'll have to add our own aliases accordingly
			const houdiniAliases = {
				$houdini: runtimeDir,
				'$houdini/*': path.join(runtimeDir, '*'),
				'~': path.join(ctx.config.root_dir, 'src'),
				'~/*': path.join(ctx.config.root_dir, 'src', '*'),
			}

			return {
				resolve: {
					...userConfig.resolve,
					alias: Array.isArray(userConfig.resolve?.alias)
						? [
								...userConfig.resolve.alias,
								...Object.entries(houdiniAliases).map(([find, replacement]) => ({
									find,
									replacement,
								})),
							]
						: { ...userConfig.resolve?.alias, ...houdiniAliases },
				},
				server: {
					...userConfig.server,
					fs: {
						...userConfig.server?.fs,
						allow: ['.'].concat(userConfig.server?.fs?.allow || []),
					},
					watch: {
						...userConfig.server?.watch,
						ignored: ['**/*.houdini_tmp'].concat(
							(userConfig.server?.watch?.ignored as string[]) || []
						),
					},
				},
			}
		},

		async buildStart() {
			// worker pipelines neither generate nor own a DB connection (see configResolved)
			if (viteConfig.isWorker) {
				return
			}

			if (!compiler && !devServer) {
				compiler = await codegen_setup(ctx.config, 'dev', ctx.db, ctx.db_file)
			}

			if (ctx.adapter?.pre && viteEnv.command === 'build') {
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
			if (!devServer && !process.env.HOUDINI_SKIP_GENERATE && !alreadyBuilt) {
				// run the codegen
				const buildResults = await compiler.run_pipeline({
					// the pipeline through schema is run as part of codegen_setup
					after: 'Schema',
				})
				const buildDocCount = Object.values(buildResults.GenerateDocuments ?? {}).flat()
					.length
				console.log(
					`🎩 Generated ${buildDocCount} ${
						buildDocCount === 1 ? 'document' : 'documents'
					}`
				)

				// make sure we don't build twice
				alreadyBuilt = true
				await compiler.close()
			}
		},

		closeBundle: {
			order: 'post',
			async handler() {
				if (
					viteEnv.mode !== 'production' ||
					devServer ||
					viteConfig.build.ssr ||
					viteConfig.isWorker
				) {
					return
				}

				if (!ctx.adapter) {
					return
				}

				const routerConventions = await import('../router/conventions.js')
				const outDir = routerConventions.router_build_directory(ctx.config)
				const sourceDir = viteConfig.build.outDir

				console.log('🎩 Generating Deployment Assets...')

				try {
					const stat = await fs.stat(outDir)
					if (stat?.isDirectory()) {
						await fs.rmdir(outDir)
					}
				} catch {}
				await fs.mkdirp(outDir)

				const { load_manifest } = await import('../router/manifest.js')
				const manifest = await load_manifest({
					config: ctx.config,
					includeArtifacts: true,
				})

				if (!ctx.adapter?.disableServer) {
					await fs.recursiveCopy(path.join(sourceDir, 'ssr'), path.join(outDir, 'ssr'))
					await fs.rmdir(path.join(sourceDir, 'ssr'))
				}
				await fs.recursiveCopy(sourceDir, path.join(outDir, 'assets'))

				await ctx.adapter({
					config: ctx.config,
					conventions: routerConventions,
					sourceDir,
					publicBase: viteConfig.base,
					outDir,
					manifest,
					adapterPath: './ssr/entries/adapter',
				})

				if (fs.existsSync(path.join(ctx.config.root_dir, 'public'))) {
					await fs.recursiveCopy(path.join(ctx.config.root_dir, 'public'), outDir)
				}
			},
		},
	}
}
