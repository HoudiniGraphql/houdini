import { fs, path } from 'houdini'
import {
	app_component_path,
	adapter_config_path,
	plugin_dir,
	client_build_directory,
} from 'houdini/router/conventions'
import { load_manifest, type ProjectManifest } from 'houdini/router/manifest'
import { type RouterManifest, type RouterPageManifest } from 'houdini/router/types'
import { VitePluginContext } from 'houdini/vite'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import type * as React from 'react'
import { build, type BuildOptions, type ConfigEnv, type Connect } from 'vite'
import { PluginOption } from 'vite'

import { transform_file, type ComponentFieldRow } from './transform.js'

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

// Resolve the node-compatible react-streaming server entry at load time. The
// resolve.alias we add in config() redirects react-streaming/server to this
// path, bypassing the package.json "browser" condition poison pill that
// rolldown picks up even in SSR builds.
const _require = createRequire(import.meta.url)
let reactStreamingServerPath = ''
let reactStreamingHooksPath = ''
try {
	const main = _require.resolve('react-streaming')
	const pkgDir = main.replace(/\/dist\/.*$/, '')
	reactStreamingServerPath = path.join(pkgDir, 'dist/server/index.node-and-web.js')
	// The bare `react-streaming` entry resolves to the browser hooks (whose useStream is a
	// no-op returning null) when rolldown picks the "browser" condition, which it does even in
	// SSR builds. The runtime calls useStreamOptional() during SSR to grab injectToStream, so
	// in the SSR build we must point the bare import at the server hooks instead.
	reactStreamingHooksPath = path.join(pkgDir, 'dist/server/hooks.js')
} catch {}

export default function (ctx: VitePluginContext): PluginOption {
	let manifest: ProjectManifest
	let viteEnv: ConfigEnv
	let devServer = false
	let isSSRBuild = false
	let cfCache: ComponentFieldRow[] | null = null

	return {
		name: 'houdini-react',

		configResolved(config) {
			isSSRBuild = !!config.build.ssr
		},

		async config(userConfig, env) {
			viteEnv = env

			const runtimeDir = path.join(
				ctx.config.root_dir,
				ctx.config.config_file.runtimeDir ?? '.houdini'
			)
			try {
				mkdirSync(runtimeDir, { recursive: true })
				const tsconfigPath = path.join(runtimeDir, 'tsconfig.json')
				if (!existsSync(tsconfigPath)) {
					writeFileSync(tsconfigPath, REACT_TSCONFIG_STUB)
				}
			} catch {}

			// SSR build: don't override outDir or input — let the inline config from
			// closeBundle() control where output lands. Transforms still run via the
			// transform hook registered on this plugin instance.
			if (userConfig.build?.ssr) {
				return reactStreamingServerPath
					? {
							resolve: {
								alias: [
									{
										find: 'react-streaming/server',
										replacement: reactStreamingServerPath,
									},
									// exact match so we don't also rewrite react-streaming/server
									{
										find: /^react-streaming$/,
										replacement: reactStreamingHooksPath,
									},
								],
							},
					  }
					: {}
			}

			try {
				manifest = await load_manifest({ config: ctx.config })
			} catch (e) {
				console.log(
					'something went wrong. please try again. \n error: ' + (e as Error).message
				)
				manifest = {
					pages: {},
					layouts: {},
					page_queries: {},
					layout_queries: {},
					artifacts: [],
					local_schema: false,
					local_yoga: false,
					component_fields: {},
				}
			}

			let conf: { build?: BuildOptions; base?: string } = {
				build: { rollupOptions: {} },
			}

			if (env.command === 'build') {
				conf.base = '/assets'
			}

			const compiledAssetsDir = client_build_directory(ctx.config)
			await fs.mkdirp(compiledAssetsDir)

			conf.build = {
				outDir: compiledAssetsDir,
				rollupOptions: {
					output: {
						assetFileNames: 'assets/[name].js',
						entryFileNames: '[name].js',
					},
					input: {
						'entries/app': app_component_path(ctx.config),
						...(ctx.adapter
							? { 'entries/adapter': adapter_config_path(ctx.config) }
							: {}),
					},
				},
			}

			if (env.command === 'build' && ctx.adapter && ctx.adapter.includePaths) {
				const extra =
					typeof ctx.adapter.includePaths === 'function'
						? ctx.adapter.includePaths({ config: ctx.config })
						: ctx.adapter.includePaths
				Object.assign(conf.build!.rollupOptions!.input ?? {}, extra)
			}

			for (const [id, page] of Object.entries(manifest.pages)) {
				;(conf.build!.rollupOptions!.input as Record<string, string>)[
					`pages/${id}`
				] = `virtual:houdini/pages/${page.id}.jsx`
			}

			return reactStreamingServerPath
				? {
						...conf,
						resolve: { alias: { 'react-streaming/server': reactStreamingServerPath } },
				  }
				: conf
		},

		resolveId(id) {
			if (id.includes('virtual:houdini')) {
				return id.substring(id.indexOf('virtual:houdini'))
			}
			return null
		},

		hotUpdate() {
			// Clear after every HMR cycle so the next transform re-queries the DB.
			// Safe because transform is only called after the pipeline has finished.
			cfCache = null
		},

		async transform(code: string, filepath: string, options?: { ssr?: boolean }) {
			filepath = path.posixify(filepath)

			if (filepath.startsWith('/src/')) {
				filepath = path.join(process.cwd(), filepath)
			}

			if (!ctx.config.includeFile(filepath)) {
				return
			}

			// headers() is server-only; strip it from the client build of route
			// views so it never reaches the browser bundle (see transform_file).
			const stripHeaders = !options?.ssr && /(?:^|\/)\+(?:page|layout)\.[jt]sx?$/.test(filepath)

			if (cfCache === null) {
				try {
					cfCache = ctx.db.all<ComponentFieldRow>(
						'SELECT type, field, fragment FROM component_fields'
					)
				} catch {
					cfCache = []
				}
			}

			return transform_file(
				{
					config: ctx.config,
					content: code,
					filepath: path.posixify(filepath),
					watch_file: this.addWatchFile.bind(this),
				},
				cfCache,
				{ stripHeaders }
			)
		},

		async closeBundle() {
			if (viteEnv.mode !== 'production' || devServer || isSSRBuild) {
				return
			}

			if (!ctx.adapter || ctx.adapter?.disableServer) {
				return
			}

			const compiledAssetsDir = client_build_directory(ctx.config)

			// SSR build: uses the project vite config so all transforms (including
			// houdini graphql tag transforms) run. houdini.ts skips closeBundle for
			// ssr builds (viteConfig.build.ssr check) and skips codegen (alreadyBuilt).
			// The config hook returns {} for SSR builds to avoid overriding outDir/input,
			// so we supply both here.
			await build({
				build: {
					ssr: true,
					outDir: path.join(compiledAssetsDir, 'ssr'),
					rollupOptions: {
						output: {
							assetFileNames: 'assets/[name].js',
							entryFileNames: '[name].js',
						},
						input: {
							'entries/adapter': adapter_config_path(ctx.config),
						},
					},
				},
			})

			// houdini.ts closeBundle (order: 'post') fires next and assembles the final
			// deployment: sourceDir → build/assets, sourceDir/ssr → build/ssr, adapter → build/index.js
		},

		async load(id) {
			if (!id.startsWith('virtual:houdini')) {
				return
			}
			if (!manifest) {
				return
			}

			let [, which, arg] = id.split('/')
			const parsedPath = arg ? path.parse(arg) : ''
			const pageName = parsedPath ? parsedPath.name : ''

			if (which === 'pages') {
				let page = manifest.pages[pageName]
				if (!page) {
					// Manifest may be stale after HMR regenerated it on disk — reload and retry.
					try {
						manifest = await load_manifest({ config: ctx.config })
						page = manifest.pages[pageName]
					} catch {}
				}
				if (!page) {
					throw new Error('unknown page' + pageName)
				}

				const pendingQueries = page.queries.filter((query) => {
					const pg = Object.values(manifest.page_queries).find((q) => q.name === query)
					if (pg) {
						return pg.loading
					}
					const layout = Object.values(manifest.layout_queries).find(
						(q) => q.name === query
					)
					return layout?.loading
				})

				return `
import App from '$houdini/plugins/houdini-react/units/render/App'
import Component from '$houdini/plugins/houdini-react/units/entries/${pageName}.jsx'
import { hydrate_page } from '$houdini/plugins/houdini-react/runtime/hydration'
hydrate_page(App, Component, '${pageName}', ${JSON.stringify(pendingQueries)})
`
			}

			if (which === 'artifacts') {
				return `
import artifact from '$houdini/artifacts/${pageName}'
import { register_artifact } from '$houdini/plugins/houdini-react/runtime/hydration'
register_artifact('${pageName}', artifact)
`
			}

			if (which === 'static-entry') {
				return `
import App from '$houdini/plugins/houdini-react/units/render/App'
import manifest from '$houdini/plugins/houdini-react/runtime/manifest'
import { mount_static_app } from '$houdini/plugins/houdini-react/runtime/hydration'
mount_static_app(App, manifest)
`
			}
		},

		async configureServer(server) {
			devServer = true

			// Keep the dev server alive through SSR errors (e.g. bad PostCSS config,
			// missing local schema). Vite's HMR recovers naturally once the file is fixed.
			const onUnhandledRejection = (err: unknown) => {
				console.error('\n[houdini] dev server error (server still running):\n', err, '\n')
			}
			process.on('unhandledRejection', onUnhandledRejection)
			server.httpServer?.once('close', () =>
				process.off('unhandledRejection', onUnhandledRejection)
			)

			// Pre-warm: load the Shell entry so CSS imports populate the module
			// graph before the first browser request arrives.
			server.httpServer?.once('listening', () => {
				const addr = server.httpServer?.address()
				if (addr && typeof addr === 'object') {
					process.env.HOUDINI_PORT = String(addr.port)
				}

				const root = ctx.config.root_dir
				const entry = ['+index.tsx', '+index.jsx']
					.map((f) => path.join(root, 'src', f))
					.find((f) => existsSync(f))
				if (entry) {
					server.ssrLoadModule(entry).catch(() => {})
				}
			})

			server.middlewares.use(async (req, res, next) => {
				if (!req.url) {
					next()
					return
				}

				// Let Vite handle anything that isn't a page navigation — module scripts,
				// assets, Vite internals, and virtual modules all need to pass through.
				const url = req.url.split('?')[0]
				if (
					url.startsWith('/@') ||
					url.startsWith('/virtual:') ||
					url.startsWith('/node_modules/') ||
					/\.[a-z]+$/i.test(url)
				) {
					next()
					return
				}

				const manifest_module = (await server.ssrLoadModule(
					path.join(plugin_dir(ctx.config, 'houdini-react'), 'runtime', 'manifest.ts')
				)) as {
					default: RouterManifest<React.Component>
					route_headers?: Record<string, RouterPageManifest<React.Component>['headers']>
				}
				const router_manifest = manifest_module.default
				// route_headers is a server-only export; attach it to the manifest so the
				// request handler can evaluate headers() before streaming
				for (const id of Object.keys(manifest_module.route_headers ?? {})) {
					if (router_manifest.pages[id]) {
						router_manifest.pages[id].headers = manifest_module.route_headers![id]
					}
				}

				const { createServerAdapter } = (await server.ssrLoadModule(
					adapter_config_path(ctx.config)
				)) as { createServerAdapter: any }

				const requestHeaders = new Headers()
				for (const header of Object.entries(req.headers ?? {})) {
					requestHeaders.set(header[0], header[1] as string)
				}

				const port = server.config.server.port ?? 5173
				const request = new Request(
					`http://localhost:${port}` + req.url,
					req.method === 'POST'
						? {
								method: req.method,
								headers: requestHeaders,
								body: await getBody(req),
						  }
						: undefined
				)

				// Run the request URL through Vite's transformIndexHtml pipeline so
				// that all plugin-injected preamble scripts (e.g. react-refresh
				// bootstrap from @vitejs/plugin-react-oxc) are included in the
				// streamed response. Without this the react-refresh preamble is
				// never sent to the browser and every JSX file throws
				// "can't detect preamble".
				let documentPremable = `<script type="module" src="/@vite/client" async=""></script>`
				try {
					const transformed = await server.transformIndexHtml(
						req.url,
						'<!DOCTYPE html><html><head></head><body></body></html>'
					)
					const headMatch = transformed.match(/<head>([\s\S]*?)<\/head>/)
					if (headMatch?.[1]?.trim()) {
						documentPremable = headMatch[1].trim()
					}
				} catch {
					// fall back to the Vite client script only
				}

				// Collect CSS file URLs from loaded modules so React 19 can hoist
				// <link rel="stylesheet"> into <head> and prevent FOUC in dev.
				const cssLinkSet = new Set<string>()
				for (const [url] of server.moduleGraph.urlToModuleMap) {
					const cleanUrl = url.split('?')[0]
					if (
						!cleanUrl.includes('node_modules') &&
						cleanUrl.endsWith('.css') &&
						!cleanUrl.endsWith('.module.css')
					) {
						cssLinkSet.add(cleanUrl)
					}
				}
				const cssLinks = [...cssLinkSet]

				res.setHeader('Content-Type', 'text/html; charset=utf-8')

				try {
					const result: Response = await createServerAdapter({
						production: false,
						manifest: router_manifest,
						assetPrefix: '/virtual:houdini',
						pipe: res,
						documentPremable,
						cssLinks,
					})(request)
					if (result && result.status === 404) {
						return next()
					}
					if (result && typeof result !== 'boolean') {
						if (res.closed) {
							return
						}
						for (const header of result.headers ?? []) {
							res.setHeader(header[0], header[1])
						}
						if (result.status >= 300 && result.status < 400) {
							res.writeHead(result.status, {
								Location: result.headers.get('Location') ?? '',
								...[...result.headers].reduce(
									(headers, [key, value]) => ({
										...headers,
										[key]: value,
									}),
									{}
								),
							})
						} else {
							res.write(await result.text())
						}
						res.end()
					}
				} catch (e) {
					console.error(e)
					res.end()
				}
			})
		},
	}
}

function getBody(request: Connect.IncomingMessage): Promise<string> {
	return new Promise((resolve) => {
		const bodyParts: Uint8Array[] = []
		let body
		request
			.on('data', (chunk: Uint8Array) => {
				bodyParts.push(chunk)
			})
			.on('end', () => {
				body = Buffer.concat(bodyParts).toString()
				resolve(body)
			})
	})
}
