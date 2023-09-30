import { GraphQLSchema } from 'graphql'
import {
	PluginHooks,
	path,
	fs,
	load_manifest,
	routerConventions,
	isSecondaryBuild,
	type ProjectManifest,
	type ServerAdapterFactory,
	type YogaServer,
	RouterManifest,
	find_match,
	localApiEndpoint,
	loadLocalSchema,
} from 'houdini'
import type { BuildOptions } from 'vite'

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

export default {
	// we want to set up some vite aliases by default
	async config(config, env) {
		manifest = await load_manifest({ config, includeArtifacts: env.mode === 'production' })
		setManifest(manifest)

		// secondary builds have their own rollup config
		let rollupConfig: BuildOptions | undefined
		// build up the list of entries that we need vite to bundle
		if (!isSecondaryBuild()) {
			rollupConfig = {
				rollupOptions: {
					output: {
						entryFileNames: 'assets/[name].js',
					},
				},
			}

			await fs.mkdirp(config.compiledAssetsDir)
			rollupConfig.outDir = config.compiledAssetsDir
			rollupConfig.rollupOptions!.input = {}

			// every page in the manifest is a new entry point for vite
			for (const [id, page] of Object.entries(manifest.pages)) {
				rollupConfig.rollupOptions!.input[
					`pages/${id}`
				] = `virtual:houdini/pages/${page.id}@${page.queries}.jsx`
			}

			// every artifact asset needs to be bundled individually
			for (const artifact of manifest.artifacts) {
				rollupConfig.rollupOptions!.input[
					`artifacts/${artifact}`
				] = `virtual:houdini/artifacts/${artifact}.js`
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
			build: rollupConfig,
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

				// hydrate the application for interactivity
				hydrateRoot(document, <App cache={window.__houdini__cache__} session={window.__houdini__initial__session__} {...window.__houdini__nav_caches__} />)
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
		await writeTsconfig(server.houdiniConfig)

		server.middlewares.use(async (req, res, next) => {
			// import the router manifest from the runtime
			// pull in the project's manifest
			const { default: router_manifest } = (await server.ssrLoadModule(
				path.join(
					server.houdiniConfig.pluginRuntimeDirectory('houdini-react'),
					'manifest.js'
				)
			)) as { default: RouterManifest<React.Component> }

			// any requests for things that aren't routes shouldn't be handled
			try {
				const [match] = find_match(router_manifest, req.url ?? '/')
				if (!match) {
					throw new Error()
				}
			} catch {
				if (req.url !== localApiEndpoint(server.houdiniConfig.configFile)) {
					return next()
				}
			}

			// its worth loading the project manifest
			const project_manifest = await load_manifest({ config: server.houdiniConfig })

			// import the schema
			let schema: GraphQLSchema | null = null
			if (project_manifest.local_schema) {
				schema = await loadLocalSchema(server.houdiniConfig)
			}
			// import the schema
			const serverAdapter: (
				args: Omit<Parameters<ServerAdapterFactory>[0], 'on_render'>
			) => ReturnType<ServerAdapterFactory> = (
				await server.ssrLoadModule(
					routerConventions.server_adapter_path(server.houdiniConfig) +
						'?t=' +
						new Date().getTime()
				)
			).default
			let yoga: YogaServer | null = null
			if (project_manifest.local_yoga) {
				const yogaPath = path.join(
					server.houdiniConfig.localApiDir,
					'+yoga?t=' + new Date().getTime()
				)
				yoga = (await server.ssrLoadModule(yogaPath)) as YogaServer
			}

			const mod = await server.ssrLoadModule(
				routerConventions.adapter_config_path(server.houdiniConfig) +
					'?t=' +
					new Date().getTime()
			)

			// call the adapter with the latest information
			await serverAdapter({
				schema,
				yoga,
				assetPrefix: '/virtual:houdini',
				production: false,
				manifest: router_manifest,
				pipe: res,
				componentCache: mod.componentCache,
			})(req, res)
		})
	},
} as PluginHooks['vite']
