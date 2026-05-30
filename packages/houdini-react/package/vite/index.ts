import { build, type BuildOptions, type ConfigEnv, type Connect } from 'vite'
import type * as React from 'react'

import { fs, path } from 'houdini'
import { VitePluginContext } from 'houdini/vite'
import { load_manifest, type ProjectManifest } from 'houdini/router/manifest'
import {
	app_component_path,
	adapter_config_path,
	plugin_dir,
	client_build_directory,
} from 'houdini/router/conventions'
import { type RouterManifest } from 'houdini/router/types'
import { PluginOption } from 'vite'

import { transform_file, type ComponentFieldRow } from './transform.js'

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

			// SSR build: don't override outDir or input — let the inline config from
			// closeBundle() control where output lands. Transforms still run via the
			// transform hook registered on this plugin instance.
			if (userConfig.build?.ssr) {
				return {}
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
						...(ctx.adapter ? { 'entries/adapter': adapter_config_path(ctx.config) } : {}),
					},
				},
			}

			if (env.command === 'build' && ctx.adapter && ctx.adapter.includePaths) {
				const extra =
					typeof ctx.adapter.includePaths === 'function'
						? ctx.adapter.includePaths({ config: ctx.config })
						: ctx.adapter.includePaths
				Object.assign(conf.build!.rollupOptions!.input, extra)
			}

			for (const [id, page] of Object.entries(manifest.pages)) {
				;(conf.build!.rollupOptions!.input as Record<string, string>)[
					`pages/${id}`
				] = `virtual:houdini/pages/${page.id}.jsx`
			}

			return conf
		},

		resolveId(id) {
			if (!id.includes('virtual:houdini')) {
				return
			}
			return id.substring(id.indexOf('virtual:houdini'))
		},

		async transform(code: string, filepath: string) {
			filepath = path.posixify(filepath)

			if (filepath.startsWith('/src/')) {
				filepath = path.join(process.cwd(), filepath)
			}

			if (!ctx.config.includeFile(filepath)) {
				return
			}

			if (cfCache === null) {
				try {
					cfCache = ctx.db
						.prepare('SELECT type, field, fragment FROM component_fields')
						.all() as ComponentFieldRow[]
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
				cfCache
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
				const page = manifest.pages[pageName]
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

			server.middlewares.use(async (req, res, next) => {
				if (!req.url) {
					next()
					return
				}

				const { default: router_manifest } = (await server.ssrLoadModule(
					path.join(plugin_dir(ctx.config, 'houdini-react'), 'runtime', 'manifest.ts')
				)) as { default: RouterManifest<React.Component> }

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

				try {
					const result: Response = await createServerAdapter({
						production: false,
						manifest: router_manifest,
						assetPrefix: '/virtual:houdini',
						pipe: res,
						documentPremable,
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
