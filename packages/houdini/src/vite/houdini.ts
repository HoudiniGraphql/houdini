import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { ResolvedConfig, ConfigEnv as ViteEnv, Plugin as VitePlugin } from 'vite'

import type { VitePluginContext } from './index.js'
import { codegen_setup } from '../lib/codegen.js'
import * as fs from '../lib/fs.js'
import type { CompilerProxy } from '../lib/index.js'

// Matches GenerateTsConfig in packages/houdini-react/plugin/runtime.go — keep in sync.
const REACT_TSCONFIG_STUB = `{
    "compilerOptions": {
        "baseUrl": ".",
        "paths": {
            "$houdini": ["."],
            "$houdini/*": ["./*"],
            "~": ["../src"],
            "~/*": ["../src/*"]
        },
        "rootDirs": ["..", "./types"],
        "target": "ESNext",
        "useDefineForClassFields": true,
        "lib": ["DOM", "DOM.Iterable", "ESNext"],
        "allowJs": true,
        "skipLibCheck": true,
        "esModuleInterop": false,
        "allowSyntheticDefaultImports": true,
        "strict": true,
        "forceConsistentCasingInFileNames": true,
        "module": "ESNext",
        "moduleResolution": "Bundler",
        "allowImportingTsExtensions": true,
        "resolveJsonModule": true,
        "isolatedModules": true,
        "noEmit": true,
        "jsx": "react-jsx"
    },
    "include": [
        "ambient.d.ts",
        "./types/**/$types.d.ts",
        "../vite.config.ts",
        "../src/**/*.js",
        "../src/**/*.ts",
        "../src/**/*.jsx",
        "../src/**/*.tsx",
        "../src/+app.d.ts"
    ],
    "exclude": ["../node_modules/**", "./[!ambient.d.ts]**"]
}
`

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
		},

		async config(userConfig, env) {
			viteEnv = env

			const runtimeDir = path.join(
				ctx.config.root_dir,
				ctx.config.config_file.runtimeDir ?? '.houdini'
			)

			// Write a stub tsconfig before any other plugin reads tsconfig.json.
			// The Go pipeline overwrites it with the real content on first compile.
			const tsconfigPath = path.join(runtimeDir, 'tsconfig.json')
			if (
				!fs.existsSync(tsconfigPath) &&
				ctx.config.plugins.some((p) => p.name === 'houdini-react')
			) {
				try {
					mkdirSync(runtimeDir, { recursive: true })
					writeFileSync(tsconfigPath, REACT_TSCONFIG_STUB)
				} catch {}
			}

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
				},
			}
		},

		async buildStart() {
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
				if (viteEnv.mode !== 'production' || devServer || viteConfig.build.ssr) {
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
