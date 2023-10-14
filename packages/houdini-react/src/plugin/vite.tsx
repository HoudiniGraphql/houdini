import {
	PluginHooks,
	path,
	fs,
	load_manifest,
	isSecondaryBuild,
	type ProjectManifest,
	type RouterManifest,
	routerConventions,
} from 'houdini'
import React from 'react'
import { build, type BuildOptions, type Connect } from 'vite'

import { setManifest } from '.'
import { writeTsconfig } from './codegen/typeRoot'

// in order to coordinate the client and server, the client's pending request cache
// needs to start with a value for every query that we are sending on the server.
// While values resolve, chunks are sent, etc, the pending cache will be resolved
// and components will be allowed to render if their data cache is sufficiently full
// We need to generate all sorts of files to make this work and in development, we want
// to rely heavily on Vite's dev server for loading things so that we can make sure we always
// integrate well with hmr. We're going to use virtual modules in place of the statically
// generated files.

// Here is a potentially incomplete list of things that are mocked / need to be generated:
// virtual:houdini/pages/[query_names.join(',')] - An entry for every page that starts the pending cache with the correct values
// virtual:houdini/artifacts/[name] - An entry for loading an artifact and notifying the artifact cache

let manifest: ProjectManifest
let devServer: boolean = false

export default {
	// we want to set up some vite aliases by default
	async config(config, env) {
		manifest = await load_manifest({ config, includeArtifacts: env.mode === 'production' })
		setManifest(manifest)

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

			// every page in the manifest is a new entry point for vite
			for (const [id, page] of Object.entries(manifest.pages)) {
				conf.build!.rollupOptions!.input[
					`pages/${id}`
				] = `virtual:houdini/pages/${page.id}@${page.queries}.jsx`
			}

			// every artifact asset needs to be bundled individually
			for (const artifact of manifest.artifacts) {
				conf.build!.rollupOptions!.input[
					`artifacts/${artifact}`
				] = `virtual:houdini/artifacts/${artifact}.js`
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

	async buildStart({ houdiniConfig }) {
		await writeTsconfig(houdiniConfig)
	},

	async closeBundle(this, config) {
		// tell the user what we're doing
		console.log('🎩 Generating Server Assets...')

		process.env.HOUDINI_SECONDARY_BUILD = 'ssr'
		// in order to build the server-side of the application, we need to
		// treat every file as an independent entry point and disable
		await build({
			build: {
				ssr: true,
				outDir: path.join(config.rootDir, 'build', 'ssr'),
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
		const parsedPath = path.parse(arg)
		arg = parsedPath.name

		// if we are rendering the virtual page
		if (which === 'pages') {
			const [id, query_names] = arg.split('@')
			const queries = query_names ? query_names.split(',') : []
			return `
				import React from 'react'
				import { hydrateRoot } from 'react-dom/client';
				import App from '$houdini/plugins/houdini-react/units/render/App'
				import { Cache } from '$houdini/runtime/cache/cache'
				import { router_cache } from '$houdini'
				import client from '$houdini/plugins/houdini-react/runtime/client'
				import Component from '$houdini/plugins/houdini-react/units/entries/${id}.jsx'
				import { injectComponents } from '$houdini/plugins/houdini-react/runtime/componentFields'

				// if there is pending data (or artifacts) then we should prime the caches
				let initialData = {}
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
				window.__houdini__hydration__layer__ ??= window.__houdini__cache__._internal_unstable.storage.createLayer(true)

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
								variables: window.__houdini__pending_variables__[artifactName],
							})
						}

						// create the store we'll put in the cache
						const observer = window.__houdini__client__.observe({
							artifact,
							cache: window.__houdini__cache__,
							initialValue: window.__houdini__pending_data__[artifactName],
							initialVariables: variables,
						})

						// save it in the cache
						initialData[artifactName] = observer
					}

				}

				// attach things to the global scope to synchronize streaming
				if (!window.__houdini__nav_caches__) {
					window.__houdini__nav_caches__ = router_cache({
						pending_queries: ${JSON.stringify(queries)},
						initialData,
						initialArtifacts,
						components: {
							'${id}': Component
						}
					})
				}

				// hydrate the cache with the information from the initial payload
				window.__houdini__cache__?.hydrate(
					window.__houdini__initial__cache__,
					window.__houdini__hydration__layer__
				)

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
				path.join(config.artifactDirectory, arg + '.js')
			))!.replace('export default', 'const artifact = ')

			return (
				artifact +
				`
if (window.__houdini__nav_caches__ && window.__houdini__nav_caches__.artifact_cache && !window.__houdini__nav_caches__.artifact_cache.has("${arg}")) {
	window.__houdini__nav_caches__.artifact_cache.set(${JSON.stringify(arg)}, artifact)
}
`
			)
		}
	},

	// when running the dev server, we want to use the same streaming
	// render that we will use in production. This means that we need to
	// capture the request before vite's dev server processes it.
	async configureServer(server) {
		devServer = true
		await writeTsconfig(server.houdiniConfig)

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

			// wrap the vite request in a proper on
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
			// if we got here but we didn't pipe a response then we have to send the result to the end
			if (result && typeof result !== 'boolean') {
				if (res.closed) {
					return
				}
				for (const header of Object.entries(result.headers ?? {})) {
					res.setHeader(header[0], header[1])
				}
				// handle redirects
				if (result.status >= 300 && result.status < 400) {
					res.writeHead(result.status, {
						Location: result.headers.get('Location') ?? '',
						...[...result.headers.entries()].reduce(
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
		})
	},
} as PluginHooks['vite']

// function:
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
