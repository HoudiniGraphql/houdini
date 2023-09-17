import {
	PluginHooks,
	Config,
	Cache,
	path,
	QueryArtifact,
	fs,
	type ProjectManifest,
	load_manifest,
	routerConventions,
	get_session,
	handle_request,
} from 'houdini'
import type { renderToStream as streamingRender } from 'react-streaming/server'
import { InputOption } from 'rollup'
import type { Connect, ViteDevServer } from 'vite'

import { setManifest } from '.'
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
import { RouterManifest } from '../runtime'
import { find_match } from '../runtime/routing/lib/match'
import { plugin_config } from './config'

let manifest: ProjectManifest

export default {
	// we want to set up some vite aliases by default
	async config(config, env) {
		manifest = await load_manifest({ config, includeArtifacts: env.mode === 'production' })
		setManifest(manifest)

		// build up the list of entries that we need vite to bundle
		const entries: InputOption = {}

		// every page in the manifest is a new entry point for vite
		for (const [id, page] of Object.entries(manifest.pages)) {
			entries[`pages/${id}`] = `virtual:houdini/pages/${page.id}@${page.queries}.jsx`
		}

		// every artifact asset needs to be bundled individually
		for (const artifact of manifest.artifacts) {
			entries[`artifacts/${artifact}`] = `virtual:houdini/artifacts/${artifact}.js`
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
			build: {
				outDir: config.compiledAssetsDir,
				rollupOptions: {
					input: entries,
					output: {
						entryFileNames: 'assets/[name].js',
					},
				},
			},
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
			const queries = query_names.split(',')

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
					window.__houdini__client__ = client
				}

				// the artifacts are the source of the zip (without them, we can't prime either cache)
				for (const [artifactName, artifact] of Object.entries(window.__houdini__pending_artifacts__ ?? {})) {
					// save the value in the initial artifact cache
					initialArtifacts[artifactName] = artifact

					// if we also have data for the artifact, save it in the initial data cache
					if (window.__houdini__pending_data__?.[artifactName]) {
						// create the store we'll put in the cache
						const observer = client.observe({ artifact, cache: window.__houdini__cache__, initialValue: window.__houdini__pending_data__[artifactName] })

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
	configureServer(server) {
		server.middlewares.use(houdini_server(server))

		// any routes that aren't auth routes need to be rendered by the streaming handler
		server.middlewares.use(render_stream(server))
	},
} as PluginHooks['vite']

const houdini_server = (
	server: ViteDevServer & {
		houdiniConfig: Config
	}
): Connect.NextHandleFunction => {
	return async (req, res, next) => {
		if (!req.url) {
			return next()
		}

		// pass the request onto the reusable hook from houdini
		handle_request({
			config: server.houdiniConfig.configFile,
			session_keys: plugin_config(server.houdiniConfig).auth?.sessionKeys ?? [],
			next,
			url: req.url,
			...res,
			redirect(status: number = 307, url: string) {
				// Respond with a redirect
				res.statusCode = status
				res.setHeader('location', url)
				res.setHeader('content-length', '0')

				// dont call next
				return res.end()
			},
			get_header: res.getHeader.bind(res),
			set_header: res.setHeader.bind(res),
		})
	}
}

const render_stream =
	(
		server: ViteDevServer & {
			houdiniConfig: Config
		}
	): Connect.NextHandleFunction =>
	async (request, response, next) => {
		if (!request.url) {
			return next()
		}

		// pull in the project's manifest
		const { default: manifest } = (await server.ssrLoadModule(
			path.join(server.houdiniConfig.pluginRuntimeDirectory('houdini-react'), 'manifest.js')
		)) as { default: RouterManifest }

		// find the matching url
		const [match] = find_match(manifest, request.url, true)
		if (!match) {
			return next()
		}

		// load the session information
		const config = plugin_config(server.houdiniConfig)
		const session = get_session(
			new Headers(request.headers as Record<string, string>),
			config.auth?.sessionKeys ?? []
		)

		// get the function that we can call to render the response
		// on the server
		const { render_to_stream } = await load_render(server)

		// instanitate a cache we can use
		const cache = new Cache({ disabled: false })

		// in order to stream values to the client we need to track what we load
		const loaded_queries: Record<string, { data: any; variables: any }> = {}
		const loaded_artifacts: Record<string, QueryArtifact> = {}

		// build up the pipe to render the response
		const { pipe, injectToStream } = await render_to_stream({
			loaded_queries,
			loaded_artifacts,
			url: request.url,
			cache,
			session,
			userAgent: 'Vite',
			assetPrefix: '/virtual:houdini',
		})

		// our pending cache needs to start with signals that we can alert
		// for every query that we will send as part of the initial request
		const pending_queries = Object.keys(match.documents)
		const pending_query_names = pending_queries.filter((q) => !(q in loaded_queries)).join(',')

		// start streaming the response to the user
		pipe?.(response)

		// the entry point for the page will start the pending cache with the correct values
		const entry = `/virtual:houdini/pages/${match.id}@${pending_query_names}.jsx`

		// add the initial scripts to the page
		injectToStream(`
			<script>
				window.__houdini__initial__cache__ = ${cache.serialize()};
				window.__houdini__initial__session__ = ${JSON.stringify(session)};
			</script>

			<script type="module" src="/@vite/client" async=""></script>

			<!-- add a virtual module that hydrates the client and sets up the initial pending cache -->
			<script type="module" src="${entry}" async=""></script>
		`)
	}

async function load_render(server: ViteDevServer & { houdiniConfig: Config }) {
	// load the function to redner the response from the generated output
	// this is a hack to avoid a dependency issue with pnpm (i think)
	return (await server.ssrLoadModule(
		routerConventions.render_server_path(server.houdiniConfig) + '?t=' + new Date().getTime()
	)) as {
		render_to_stream: (
			args: {
				loaded_queries: Record<string, { data: any; variables: any }>
				loaded_artifacts: Record<string, QueryArtifact>
				cache: Cache
				url: string
				session: App.Session
				assetPrefix: '/virtual:houdini'
			} & Parameters<typeof streamingRender>[1]
		) => ReturnType<typeof streamingRender>
	}
}
