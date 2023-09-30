import * as graphql from 'graphql'
import { GraphQLSchema } from 'graphql'
import { createYoga } from 'graphql-yoga'
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
	type RouterManifest,
	find_match,
	localApiEndpoint,
	loadLocalSchema,
	handle_request,
	localApiSessionKeys,
	get_session,
	Cache,
	HoudiniClient,
} from 'houdini'
import React from 'react'
import type { BuildOptions } from 'vite'

import { setManifest } from '.'
import { router_cache } from '../runtime'
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
				import { hydrateRoot } from 'react-dom/client';
				import App from '$houdini/plugins/houdini-react/units/render/App'
				import { Cache } from '$houdini/runtime/cache/cache'
				import { router_cache } from '$houdini'
				import client from '$houdini/plugins/houdini-react/runtime/client'
				import Component from '$houdini/plugins/houdini-react/units/entries/${id}.jsx'


				// if there is pending data (or artifacts) then we should prime the caches
				let initialData = {}
				let initialArtifacts = {}

				if (!window.__houdini__cache__) {
					window.__houdini__cache__ = new Cache()
					window.__houdini__hydration__layer__ = window.__houdini__cache__._internal_unstable.storage.createLayer(true)
					window.__houdini__client__ = client()
				}

				// the artifacts are the source of the zip (without them, we can't prime either cache)
				for (const [artifactName, artifact] of Object.entries(window.__houdini__pending_artifacts__ ?? {})) {
					// save the value in the initial artifact cache
					initialArtifacts[artifactName] = artifact

					// if we also have data for the artifact, save it in the initial data cache
					if (window.__houdini__pending_data__?.[artifactName]) {
						// create the store we'll put in the cache
						const observer = window.__houdini__client__.observe({ artifact, cache: window.__houdini__cache__, initialValue: window.__houdini__pending_data__[artifactName] })

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

			const graphqlEndpoint = localApiEndpoint(server.houdiniConfig.configFile)

			// any requests for things that aren't routes shouldn't be handled
			try {
				const [match] = find_match(router_manifest, req.url ?? '/')
				if (!match) {
					throw new Error()
				}
			} catch {
				if (req.url !== graphqlEndpoint) {
					console.log('skipping', req.url)
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
			// import the yoga server
			let yoga: YogaServer | null = null
			if (project_manifest.local_yoga) {
				const yogaPath = path.join(
					server.houdiniConfig.localApiDir,
					'+yoga?t=' + new Date().getTime()
				)
				yoga = (await server.ssrLoadModule(yogaPath)) as YogaServer
			} else if (project_manifest.local_schema) {
				yoga = createYoga({
					schema: schema!,
					landingPage: true,
					graphqlEndpoint,
				})
			}

			if (!req.url) {
				next()
				return
			}

			// pull out the desired url
			const url = req.url

			console.log(yoga, url)
			// if its a req we can process with yoga, do it.
			if (yoga && url === localApiEndpoint(server.houdiniConfig.configFile)) {
				console.log('yoga response')
				return yoga(req, res)
			}

			const headers = new Headers(req.headers as Record<string, string>)
			const session_keys = localApiSessionKeys(server.houdiniConfig.configFile)
			// load the session information
			const session = get_session(
				headers,
				localApiSessionKeys(server.houdiniConfig.configFile)
			)

			// maybe its a session-related req
			const authResponse = await handle_request({
				url,
				config: server.houdiniConfig.configFile,
				session_keys,
				headers: new Headers(Object.entries(headers)),
			})
			if (authResponse) {
				return authResponse
			}

			// the req is for a server-side rendered page

			// find the matching url
			const [match] = find_match(router_manifest, url)
			// instanitate a cache we can use for this request
			const cache = new Cache({ disabled: false })

			if (!match) {
				return new Response('not found', { status: 404 })
			}

			const { default: client } = (await server.ssrLoadModule(
				path.join(server.houdiniConfig.projectRoot, 'src', '+client')
			)) as { default: HoudiniClient }
			const { renderToStream } = await server.ssrLoadModule(
				routerConventions.vite_render_path(server.houdiniConfig)
			)
			const { default: App } = (await server.ssrLoadModule(
				routerConventions.app_component_path(server.houdiniConfig) +
					'?t=' +
					new Date().getTime()
			)) as { default: () => React.ReactElement }

			if (schema) {
				const graphqlEndpoint = localApiEndpoint(server.houdiniConfig.configFile)
				client.registerProxy(graphqlEndpoint, async ({ query, variables, session }) => {
					// get the parsed query
					const parsed = graphql.parse(query)

					return await graphql.execute(schema!, parsed, null, session, variables)
				})
			}

			const { injectToStream, pipe } = await renderToStream(
				React.createElement(App, {
					initialURL: url,
					cache: cache,
					session: session,
					assetPrefix: '/virtual:houdini',
					manifest: manifest,
					...router_cache(),
				}),
				{
					userAgent: 'Vite',
				}
			)

			// add the initial scripts to the page
			injectToStream(`
	<script>
		window.__houdini__initial__cache__ = ${cache.serialize()};
		window.__houdini__initial__session__ = ${JSON.stringify(session)};
	</script>

	<!--
		add a virtual module that hydrates the client and sets up the initial pending cache.
		the dynamic extension is to support dev which sees the raw jsx, and production which sees the bundled asset
	-->
	<script type="module" src="/virtual:houdini/pages/${match.id}.jsx" async=""></script>
	<!-- // <script type="module" src="\${options.assetPrefix}/pages/\${match.id}.\${options.production ? 'js' : 'jsx'}" async=""></script> ->
`)

			// start streaming the response to the user
			pipe?.(res)
		})
	},
} as PluginHooks['vite']
