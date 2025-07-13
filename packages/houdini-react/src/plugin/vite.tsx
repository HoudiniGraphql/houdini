import {
	fs,
	isSecondaryBuild,
	load_manifest,
	path,
	PluginHooks,
	type ProjectManifest,
	routerConventions,
	type RouterManifest,
} from 'houdini'
import React from 'react'
import { build, type BuildOptions, ConfigEnv, type Connect } from 'vite'

import { manifest, setManifest } from './state'

let viteEnv: ConfigEnv
let devServer = false

// in order to coordinate the client and server, the client's pending request cache
// needs to start with a value for every query that we are sending on the server.
// While values resolve, chunks are sent, etc, the pending cache will be resolved
// and components will be allowed to render if their data cache is sufficiently full
// We need to generate all sorts of files to make this work and in development, we want
// to rely heavily on Vite's dev server for loading things so that we can make sure we always
// integrate well with hmr. We're going to use virtual modules in place of the statically
// generated files.

// Here is a potentially incomplete list of things that are mocked / need to be generated:
// virtual:houdini/pages/[name] - An entry for every page
// virtual:houdini/artifacts/[name] - An entry for loading an artifact and notifying the artifact cache

export default {
	// we want to set up some vite aliases by default
	async config(config, env) {
		viteEnv = env
		let manifest: ProjectManifest
		try {
			manifest = await load_manifest({
				config,
			})
			setManifest(manifest)
		} catch (e) {
			console.log('something went wrong. please try again. \n error: ' + (e as Error).message)
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

		// secondary builds have their own rollup config
		let conf: { build?: BuildOptions; base?: string } = {
			build: {
				rollupOptions: {},
			},
		}

		// build up the list of entries that we need vite to bundle
		if (!isSecondaryBuild() || process.env.HOUDINI_SECONDARY_BUILD === 'ssr') {
			if (env.command === 'build') {
				conf.base = '/assets'
			}

			conf.build = {
				rollupOptions: {
					output: {
						assetFileNames: 'assets/[name].js',
						entryFileNames: '[name].js',
					},
				},
			}

			await fs.mkdirp(config.compiledAssetsDir)
			conf.build!.rollupOptions!.input = {
				'entries/app': routerConventions.app_component_path(config),
				'entries/adapter': routerConventions.adapter_config_path(config),
			}

			if (env.command === 'build' && config.adapter && config.adapter.includePaths) {
				if (typeof config.adapter?.includePaths === 'function') {
					Object.assign(
						conf.build!.rollupOptions!.input,
						config.adapter.includePaths({ config })
					)
				} else {
					Object.assign(conf.build!.rollupOptions!.input, config.adapter.includePaths)
				}
			}

			// every page in the manifest is a new entry point for vite
			for (const [id, page] of Object.entries(manifest.pages)) {
				conf.build!.rollupOptions!.input[
					`pages/${id}`
				] = `virtual:houdini/pages/${page.id}.jsx`
			}

			// the SSR build has a different output
			if (process.env.HOUDINI_SECONDARY_BUILD !== 'ssr') {
				conf.build!.outDir = config.compiledAssetsDir
			}
		}

		return {
			resolve: {
				alias: {
					$houdini: config.rootDir,
					'$houdini/*': path.join(config.rootDir, '*'),
					'~': path.join(config.projectRoot, 'src'),
					'~/*': path.join(config.projectRoot, 'src', '*'),
				},
			},
			type: 'custom',
			...conf,
		}
	},

	resolveId(id) {
		// we only care about the virtual modules that generate
		if (!id.includes('virtual:houdini')) {
			return
		}

		// let them all through as is but strip anything that comes before the marker
		return id.substring(id.indexOf('virtual:houdini'))
	},

	async buildEnd(_, config) {
		// skip close bundles during dev mode
		if (isSecondaryBuild() || viteEnv.mode !== 'production' || devServer) {
			return
		}

		// only continue if we are supposed to generate the server assets
		if (!config || config.adapter?.disableServer) {
			return
		}

		// tell the user what we're doing
		console.log('🎩 Generating Server Assets...')

		process.env.HOUDINI_SECONDARY_BUILD = 'ssr'
		// in order to build the server-side of the application, we need to
		// treat every file as an independent entry point and disable bundling
		await build({
			build: {
				ssr: true,
				outDir: path.join(config.rootDir, 'build', 'ssr'),
			},
		})

		process.env.HOUDINI_SECONDARY_BUILD = 'true'

		const artifacts: string[] = []

		try {
			// look at the artifact directory for every artifact
			for (const artifactPath of await fs.readdir(config.artifactDirectory)) {
				// only consider the js files
				if (!artifactPath.endsWith('.js') || artifactPath === 'index.js') {
					continue
				}

				// push the artifact path without the extension
				artifacts.push(artifactPath.substring(0, artifactPath.length - 3))
			}
		} catch {}

		// we need to build entry points for every artifact
		await build({
			build: {
				outDir: path.join(config.rootDir, 'build', 'artifacts'),
				rollupOptions: {
					input: artifacts.reduce((input, artifact) => {
						return {
							...input,
							[`${artifact}`]: `virtual:houdini/artifacts/${artifact}.js`,
						}
					}, {}),
					output: {
						entryFileNames: '[name].js',
					},
				},
			},
		})

		process.env.HOUDINI_SECONDARY_BUILD = 'false'
	},

	async load(id, { config }) {
		// we only care about the virtual modules that generate
		if (!id.startsWith('virtual:houdini')) {
			return
		}

		// pull out the relevant pa
		let [, which, arg] = id.split('/')

		// the filename is the true arg. the extension just tells vite how to transfrom.
		const parsedPath = arg ? path.parse(arg) : ''
		const pageName = parsedPath ? parsedPath.name : ''

		// if we are rendering the virtual page
		if (which === 'pages') {
			const page = manifest.pages[pageName]
			if (!page) {
				throw new Error('unknown page' + pageName)
			}

			// we need the list of queries that have loading states (and therefore create ssr signals)
			const pendingQueries = page.queries.filter((query) => {
				const page = Object.values(manifest.page_queries).find((q) => q.name === query)
				if (page) {
					return page.loading
				}
				const layout = Object.values(manifest.layout_queries).find((q) => q.name === query)
				return layout?.loading
			})

			return `
				import React from 'react'
				import { hydrateRoot } from 'react-dom/client';
				import App from '$houdini/plugins/houdini-react/units/render/App'
				import { Cache } from '$houdini/runtime/cache/cache'
				import { router_cache } from '$houdini'
				import client from '$houdini/plugins/houdini-react/runtime/client'
				import Component from '$houdini/plugins/houdini-react/units/entries/${pageName}.jsx'
				import { injectComponents } from '$houdini/plugins/houdini-react/runtime/componentFields'

				// if there is pending data (or artifacts) then we should prime the caches
				let initialData = {}
				let initialVariables = {}
				let initialArtifacts = {}

				// hydrate the client with the component cache
				window.__houdini__client__ ??= client()
				if (window.__houdini__pending_components__) {
					window.__houdini__client__.componentCache = window.__houdini__pending_components__
				}

				window.__houdini__cache__ ??= new Cache({
					componentCache: window.__houdini__client__.componentCache,
					createComponent: (fn, props) => React.createElement(fn, props)
				})
				window.__houdini__hydration__layer__ ??= window.__houdini__cache__._internal_unstable.storage.createLayer()

				// link up the cache we just created with the client
				window.__houdini__client__.setCache(window.__houdini__cache__)

				// hydrate the cache with the information from the initial payload
				window.__houdini__cache__?.hydrate(
					window.__houdini__initial__cache__,
					window.__houdini__hydration__layer__
				)

				// the artifacts are the source of the zip (without them, we can't prime either cache)
				for (const [artifactName, artifact] of Object.entries(window.__houdini__pending_artifacts__ ?? {})) {
					// save the value in the initial artifact cache
					initialArtifacts[artifactName] = artifact

					// if we also have data for the artifact, save it in the initial data cache
					if (window.__houdini__pending_data__?.[artifactName]) {
						const variables = window.__houdini__pending_variables__[artifactName]

						if (artifact.hasComponents) {
							// we need to walk down the artifacts selection and instantiate any component fields
							injectComponents({
								cache: window.__houdini__cache__,
								selection: artifact.selection,
								data: window.__houdini__pending_data__[artifactName],
								variables,
							})
						}

						// create the store we'll put in the cache
						const observer = window.__houdini__client__.observe({
							artifact,
							cache: window.__houdini__cache__,
							initialValue: window.__houdini__cache__.read({selection: artifact.selection, variables}).data,
							initialVariables: variables,
						})

						// initialize the observer we just created
						observer.send({
							setup: true,
							variables,
							session: window.__houdini__initial__session__,
						})

						// save it in the cache
						initialData[artifactName] = observer
						initialVariables[artifactName] = variables
					}

				}

				// attach things to the global scope to synchronize streaming
				if (!window.__houdini__nav_caches__) {
					window.__houdini__nav_caches__ = router_cache({
						pending_queries: ${JSON.stringify(pendingQueries)},
						initialData,
						initialVariables: window.__houdini__pending_variables__,
						initialArtifacts,
						components: {
							'${pageName}': Component
						}
					})
				}

				// get the initial url from the window
				const url = window.location.pathname

				const app = <App
					initialURL={url}
					cache={window.__houdini__cache__}
					session={window.__houdini__initial__session__}
					{...window.__houdini__nav_caches__}
				/>

				// hydrate the application for interactivity
				hydrateRoot(document, app)
			`
		}

		if (which === 'artifacts') {
			// the arg is the name of the artifact
			const artifact = (await fs.readFile(
				path.join(config.artifactDirectory, pageName + '.js')
			))!.replace('export default', 'const artifact = ')

			return (
				artifact +
				`
if (window.__houdini__nav_caches__ && window.__houdini__nav_caches__.artifact_cache && !window.__houdini__nav_caches__.artifact_cache.has("${pageName}")) {
	window.__houdini__nav_caches__.artifact_cache.set(${JSON.stringify(pageName)}, artifact)
}
`
			)
		}

		if (which === 'static-entry') {
			return `
import App from '$houdini/plugins/houdini-react/units/render/App'
import { Cache } from '$houdini/runtime/cache/cache'
import { router_cache } from '$houdini/plugins/houdini-react/runtime/routing'
import manifest from '$houdini/plugins/houdini-react/runtime/manifest'
import React from 'react'
import { createRoot } from 'react-dom/client'

const domNode = document.getElementById('app')
const root = createRoot(domNode)

const cache = new Cache()

root.render(React.createElement(App, {
	initialURL: window.location.pathname,
	cache: cache,
	session: null,
	manifest: manifest,

	...router_cache()
}))
`
		}
	},

	// when running the dev server, we want to use the same streaming
	// render that we will use in production. This means that we need to
	// capture the request before vite's dev server processes it.
	async configureServer(server) {
		devServer = true

		server.middlewares.use(async (req, res, next) => {
			if (!req.url) {
				next()
				return
			}

			// import the router manifest from the runtime
			// pull in the project's manifest
			const { default: router_manifest } = (await server.ssrLoadModule(
				path.join(
					server.houdiniConfig.pluginRuntimeDirectory('houdini-react'),
					'manifest.js'
				)
			)) as { default: RouterManifest<React.Component> }

			// load the render factory
			const { createServerAdapter } = (await server.ssrLoadModule(
				routerConventions.adapter_config_path(server.houdiniConfig)
			)) as { createServerAdapter: any }

			const requestHeaders = new Headers()
			for (const header of Object.entries(req.headers ?? {})) {
				requestHeaders.set(header[0], header[1] as string)
			}

			// wrap the vite request in a proper one
			const request = new Request(
				'https://localhost:5173' + req.url,
				req.method === 'POST'
					? {
							method: req.method,
							headers: requestHeaders,
							body: await getBody(req),
					  }
					: undefined
			)

			for (const [key, value] of Object.entries(req.headers)) {
				request.headers.set(key, value as string)
			}

			try {
				// instantiate the handler and invoke it with a mocked response
				const result: Response = await createServerAdapter({
					production: false,
					manifest: router_manifest,
					assetPrefix: '/virtual:houdini',
					pipe: res,
					documentPremable: `<script type="module" src="/@vite/client" async=""></script>`,
				})(request)
				if (result && result.status === 404) {
					return next()
				}
				// TODO: this is so awkward....
				// if we got here but we didn't pipe a response then we have to send the result to the end
				// by default result is a Response
				if (result && typeof result !== 'boolean') {
					if (res.closed) {
						return
					}
					for (const header of result.headers ?? []) {
						res.setHeader(header[0], header[1])
					}
					// handle redirects
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
} as PluginHooks['vite']

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
