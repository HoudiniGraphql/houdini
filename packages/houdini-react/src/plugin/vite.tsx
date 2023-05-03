import { PluginHooks, Config, Cache, path, QueryArtifact, fs } from 'houdini'
import ReactDOMServer, { RenderToPipeableStreamOptions } from 'react-dom/server'
import { Transform } from 'stream'
import type { ViteDevServer } from 'vite'

import { RouterManifest } from '../runtime'
import { find_match } from '../runtime/routing/lib/match'
import { render_server_path } from './conventions'

// in order to coordinate the client and server, the client's pending request cache
// needs to start with a value for every query that we are sending on the server.
// While values resolve, chunks are sent, etc, the pending cache will be resolved
// and components will be allowed to render assume their data cache is sufficiently full

// We need to generate all sorts of files and in development, we want to rely heavily on
// Vite's dev server for loading things so that we can make sure we always integrate
// well with their hmr. This means using virtual modules in place of the statically generated
// files.

// A potentially incomplete list of things that are mocked / need to be generated:
// @@houdini/page/[query_names.join(',')] - An entry for every page that starts the pending cache with the correct values
// @@houdini/artifact/[name] - An entry for loading an artifact and notifying the artifact cache

export default {
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
			const [id, query_names, artifact_names] = arg.split('@')
			const queries = query_names.split(',')
			const artifacts = artifact_names.split(',')

			return `
				import { hydrateRoot } from 'react-dom/client';
				import App from '$houdini/plugins/houdini-react/units/render/App'
				import { Cache } from '$houdini/runtime/cache/cache'
				import { router_cache } from '$houdini'
				import client from '$houdini/plugins/houdini-react/runtime/client'
				import Component from '$houdini/plugins/houdini-react/units/entries/${id}.jsx'

				${artifacts
					.map(
						(artifact) => `import ${artifact} from "$houdini/artifacts/${artifact}.js"`
					)
					.join('\n')}

				// attach things to the global scope to synchronize streaming
				window.__houdini__nav_caches__ = router_cache({
					pending_queries: ${JSON.stringify(queries)},
					artifacts: { ${artifacts.join(',')} },
					components: {
						'${id}': Component
					}
				})
				window.__houdini__cache__ = new Cache()
				window.__houdini__hydration__layer__ = window.__houdini__cache__._internal_unstable.storage.createLayer(true)
				window.__houdini__client__ = client


				// hydrate the cache with the information from the initial payload
				window.__houdini__cache__.hydrate(
					window.__houdini__initial__cache__,
					window.__houdini__hydration__layer__
				)

				// hydrate the application for interactivity
				hydrateRoot(document, <App cache={window.__houdini__cache__} {...window.__houdini__nav_caches__} />)
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

console.log(artifact)
`
			)
		}
	},

	// when running the dev server, we want to use the same streaming
	// render that we will use in production. This means that we need to
	// capture the request before vite's dev server processes it.
	configureServer(server) {
		server.middlewares.use(async (request, response, next) => {
			if (!request.url) {
				return next()
			}

			// pull in the project's manifest
			const { default: manifest } = (await server.ssrLoadModule(
				path.join(
					server.houdiniConfig.pluginRuntimeDirectory('houdini-react'),
					'manifest.js'
				)
			)) as { default: RouterManifest }

			// find the matching url
			const [match] = find_match(manifest, request.url, true)
			if (!match) {
				return next()
			}

			// get the function that we can call to render the response
			// on the server
			const render_server = await load_render(server)

			// instanitate a cache we can use
			const cache = new Cache({ disabled: false })

			// The way we push logic down to the client is by appending values
			// to the stream. Each new chunk is executed so if we push <script> tags
			// we can interact with the global scope. we're going to use this to coordinate
			// our cache hydration as the initial response streams to the client.
			let chunkNumber = 0

			// in order to stream values to the client we need to track what we load
			const loaded_queries: Record<string, { data: any }> = {}
			const loaded_artifacts: Record<string, QueryArtifact> = {}

			// our pending cache needs to start with signals that we can alert
			// for every query that we will send as part of the initial request
			const pending_queries = Object.keys(match.documents)
			const pending_query_names = pending_queries
				.filter((q) => !(q in loaded_queries))
				.join(',')

			// in order to be able to hydrate the cache with the data
			// we grabbed from the server, we need to inject some information in the stream
			const modifyStream = new Transform({
				// the transform function receives the incoming data and a callback
				transform(chunk, _, next) {
					// in render call below, we added an string that we need to replace with a serialized
					// version of the caches data
					let new_value = chunk.toString()

					// if we don't have the initialization scripts yet, add it
					if (!chunkNumber++) {
						new_value += `
<script>
	window.__houdini__initial__cache__ = ${cache.serialize()};
</script>
<script type="module" src="/@vite/client" async=""></script>
<!-- add a virtual module that loads the client and sets up the initial pending cache -->
<script type="module" src="@@houdini/page/${match.id}@${pending_query_names}@${Object.keys(
							loaded_artifacts
						).join(',')}.jsx" async=""></script>`

						// we're done
						next(null, new_value)
						return
					}

					// we're sending a chunk after the first

					// push a script that hydrates the cache more
					new_value = `
<script>
	window.__houdini__cache__.hydrate(${cache.serialize()}, window.__houdini__hydration__layer)

	// every query that we have resolved here can be resolved in the cache
	${Object.keys(loaded_queries)
		.map(
			(query) => `
			if (window.__houdini__nav_caches__.pending_cache.has("${query}")) {
				// before we resolve the pending signals,
				// fill the data cache with values we got on the server
				window.__houdini__nav_caches__.data_cache.set(
					"${query}",
					window.__houdini__client__.observe({
						artifact: window.__houdini__nav_caches__.artifact_cache.get("${query}"),
						cache: window.__houdini__cache__,
						initialValue: ${JSON.stringify(loaded_queries[query].data)}
					})
				)

				// notify anyone waiting on the pending cache
				window.__houdini__nav_caches__.pending_cache.get("${query}").resolve()
				window.__houdini__nav_caches__.pending_cache.delete("${query}")
			}
	`
		)
		.join('\n')}


</script>
${Object.keys(loaded_artifacts)
	.map((name) => `<script type="module" src="@@houdini/artifact/${name}.js" async=""></script>`)
	.join('\n')}

${new_value}
`

					// pass the modified data to the next stream in the pipeline
					next(null, new_value)
				},
			})

			// render the response
			render_server({
				loaded_queries,
				loaded_artifacts,
				url: request.url,
				cache,
				onError() {
					// TODO
				},
				onShellReady(pipe) {
					response.setHeader('content-type', 'text/html')
					pipe(modifyStream).pipe(response)
				},
			})
		})
	},
} as PluginHooks['vite']

async function load_render(server: ViteDevServer & { houdiniConfig: Config }) {
	// load the function to rener the response from the generated output
	// this is a hack to avoid a dependency issue with pnpm (i think)
	const { render_server } = (await server.ssrLoadModule(
		render_server_path(server.houdiniConfig) + '?t=' + new Date().getTime()
	)) as {
		render_server: (
			config: Omit<RenderToPipeableStreamOptions, 'onShellReady' | 'url'> & {
				loaded_queries: Record<string, { data: any }>
				loaded_artifacts: Record<string, QueryArtifact>
				cache: Cache
				url: string
				onShellReady: (
					pipe: ReturnType<(typeof ReactDOMServer)['renderToPipeableStream']>['pipe']
				) => void
			}
		) => void
	}

	return render_server
}
