import { PluginHooks, Config, Cache, path, QueryArtifact, fs } from 'houdini'
import type { renderToStream as streamingRender } from 'react-streaming/server'
import type { Connect, ViteDevServer } from 'vite'

import { RouterManifest } from '../runtime'
import { find_match } from '../runtime/routing/lib/match'
import { configure_server } from '../server'
import { dev_server } from '../server/compat'
import { get_session } from '../server/session'
import { plugin_config } from './config'
import { render_server_path } from './conventions'

// in order to coordinate the client and server, the client's pending request cache
// needs to start with a value for every query that we are sending on the server.
// While values resolve, chunks are sent, etc, the pending cache will be resolved
// and components will be allowed to render if their data cache is sufficiently full

// We need to generate all sorts of files to make this work and in development, we want
// to rely heavily on Vite's dev server for loading things so that we can make sure we always
// integrate well with hmr. We're going to use virtual modules in place of the statically
// generated files.

// Here is a potentially incomplete list of things that are mocked / need to be generated:
// @@houdini/page/[query_names.join(',')] - An entry for every page that starts the pending cache with the correct values
// @@houdini/artifact/[name] - An entry for loading an artifact and notifying the artifact cache

export default {
	// we want to set up some vite aliases by default
	config(config) {
		return {
			resolve: {
				alias: {
					$houdini: config.rootDir,
					'$houdini/*': path.join(config.rootDir, '*'),
					'~': path.join(config.projectRoot, 'src'),
					'~/*': path.join(config.projectRoot, 'src', '*'),
				},
			},
		}
	},

	resolveId(id) {
		// we only care about the virtual modules that generate
		if (!id.includes('@@houdini')) {
			return
		}

		// let them all through as is but strip anything that comes before the marker
		return id.substring(id.indexOf('@@houdini'))
	},

	async load(id, { config }) {
		// we only care about the virtual modules that generate
		if (!id.startsWith('@@houdini')) {
			return
		}

		// pull out the relevant pa
		let [, which, arg] = id.split('/')

		// the filename is the true arg. the extension just tells vite how to transfrom.
		const parsedPath = path.parse(arg)
		arg = parsedPath.name

		// if we are rendering the virtual page
		if (which === 'page') {
			const [id, query_names] = arg.split('@')
			const queries = query_names.split(',')

			return `
				import { hydrateRoot } from 'react-dom/client';
				import App from '$houdini/plugins/houdini-react/units/render/App'
				import { Cache } from '$houdini/runtime/cache/cache'
				import { router_cache } from '$houdini'
				import client from '$houdini/plugins/houdini-react/runtime/client'
				import Component from '$houdini/plugins/houdini-react/units/entries/${id}.jsx'


				// attach things to the global scope to synchronize streaming
				window.__houdini__nav_caches__ = router_cache({
					pending_queries: ${JSON.stringify(queries)},
					components: {
						'${id}': Component
					}
				})
				window.__houdini__cache__ = new Cache()
				window.__houdini__hydration__layer__ = window.__houdini__cache__._internal_unstable.storage.createLayer(true)
				window.__houdini__client__ = client


				// hydrate the cache with the information from the initial payload
				window.__houdini__cache__?.hydrate(
					window.__houdini__initial__cache__,
					window.__houdini__hydration__layer__
				)

				// hydrate the application for interactivity
				hydrateRoot(document, <App cache={window.__houdini__cache__} session={window.__houdini__initial__session__} {...window.__houdini__nav_caches__} />)
			`
		}

		if (which === 'artifact') {
			// the arg is the name of the artifact
			const artifact = (await fs.readFile(
				path.join(config.artifactDirectory, arg + '.js')
			))!.replace('export default', 'const artifact = ')

			return (
				artifact +
				`
if (window.__houdini__nav_caches__ && window.__houdini__nav_caches__.artifact_cache && !window.__houdini__nav_caches__.artifact_cache.has("${arg}")) {
	window.__houdini__nav_caches__.artifact_cache.set(${arg}, artifact)
}
`
			)
		}
	},

	// when running the dev server, we want to use the same streaming
	// render that we will use in production. This means that we need to
	// capture the request before vite's dev server processes it.
	configureServer(server) {
		// wrap vite's server into the generic server interface
		const houdini_server = dev_server({
			server: server.middlewares,
			config: server.houdiniConfig,
		})

		// inject the necessary routes into vite's internal connect server
		configure_server({
			server: houdini_server,
			config: server.houdiniConfig,
		})

		// any routes that aren't auth routes need to be rendered by the streaming handler
		server.middlewares.use(render_stream(server))
	},
} as PluginHooks['vite']

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
		})

		// our pending cache needs to start with signals that we can alert
		// for every query that we will send as part of the initial request
		const pending_queries = Object.keys(match.documents)
		const pending_query_names = pending_queries.filter((q) => !(q in loaded_queries)).join(',')

		// start streaming the response to the user
		pipe?.(response)

		// add the initial scripts to the page
		injectToStream(`
		<script>
			window.__houdini__initial__cache__ = ${cache.serialize()};
			window.__houdini__initial__session__ = ${JSON.stringify(session)};
		</script>

		<script type="module" src="/@vite/client" async=""></script>

		<!-- add a virtual module that loads the client and sets up the initial pending cache -->
		<script type="module" src="@@houdini/page/${match.id}@${pending_query_names}.jsx" async=""></script>
	`)
	}

async function load_render(server: ViteDevServer & { houdiniConfig: Config }) {
	// load the function to rener the response from the generated output
	// this is a hack to avoid a dependency issue with pnpm (i think)
	return (await server.ssrLoadModule(
		render_server_path(server.houdiniConfig) + '?t=' + new Date().getTime()
	)) as {
		render_to_stream: (
			args: {
				loaded_queries: Record<string, { data: any; variables: any }>
				loaded_artifacts: Record<string, QueryArtifact>
				cache: Cache
				url: string
				session: App.Session
			} & Parameters<typeof streamingRender>[1]
		) => ReturnType<typeof streamingRender>
	}
}
