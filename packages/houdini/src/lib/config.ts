import * as graphql from 'graphql'
import type { GraphQLSchema } from 'graphql'
import { minimatch } from 'minimatch'

import type { OAuthProvider, OAuthUser, OAuthTokens } from '../oauth/index.js'
import { plugin_dir } from '../router/conventions.js'
import * as path from './path.js'
import type { PluginMeta } from './project.js'
import type { CachePolicies, PaginateModes } from './types.js'

// the values we can take in from the config file
export type ConfigFile = {
	/**
	 * A glob pointing to all files that houdini should consider. Note, this must include .js files
	 * for inline queries to work
	 * @default `src/** /*.{svelte,graphql,gql,ts,js}`
	 */
	include?: string | string[]

	/**
	 * A pattern used to remove matches from files that satisfy the include value
	 */
	exclude?: string | string[]

	/**
	 * A static representation of your schema
	 * @example path: `schema.graphql`
	 * @example glob: `src/** /*.graphql`
	 *
	 * FYI: `schemaPath` or `schema` should be defined
	 */
	schemaPath?: string

	/**
	 * An object describing custom scalars for your project. For more information: https://www.houdinigraphql.com/api/config#custom-scalars
	 */
	scalars?: ScalarMap

	/**
	 * Client-side router behavior (houdini-react).
	 */
	router?: {
		/**
		 * How long (ms) a navigation transition may stay pending before the route's
		 * @loading state is shown. Fast navigations resolve first and never show it.
		 * @default 200
		 */
		loadingDelay?: number
		/**
		 * Once the @loading state is shown, keep it visible at least this long (ms) so a
		 * response that lands just after `loadingDelay` doesn't cause a skeleton flicker.
		 * @default 400
		 */
		minDuration?: number
	}

	/**
	 * A path that the generator will use to write schema.graphql and documents.gql files containing all of the internal fragment and directive definitions used in the project.
	 */
	definitionsPath?: string

	/**
	 * One of "esm" or "commonjs". Tells the artifact generator what kind of modules to create. (default: `esm`)
	 */
	module?: 'esm' | 'commonjs'

	/**
	 * The number of queries that must occur before a value is removed from the cache. For more information: https://www.houdinigraphql.com/guides/caching-data
	 */
	cacheBufferSize?: number

	/**
	 * The default cache policy to use for queries. For more information: https://www.houdinigraphql.com/guides/caching-data
	 */
	defaultCachePolicy?: CachePolicies

	/**
	 * Specifies whether or not the cache should always use partial data. For more information: https://www.houdinigraphql.com/guides/caching-data#partial-data
	 */
	defaultPartial?: boolean

	/**
	 * Specifies after how long a data goes stale in miliseconds. (default: `undefined`)
	 */
	defaultLifetime?: number

	/**
	 * Specifies whether mutations should append or prepend list. For more information: https://www.houdinigraphql.com/api/graphql (default: `append`)
	 */
	defaultListPosition?: 'append' | 'prepend'

	/**
	 * Specifies whether mutation should apply a specific target list. When you set `all`, it's like adding the directive `@allLists` to all _insert fragment (default: `null`)
	 */
	defaultListTarget?: 'all' | null

	/**
	 * Specifies whether the default paginate mode is Infinite or SinglePage. (default: `Infinite`)
	 */
	defaultPaginateMode?: PaginateModes

	/**
	 * Prevents the runtime from deduplicating pagination requests
	 */
	supressPaginationDeduplication?: boolean

	/**
	 * A list of fields to use when computing a record’s id. The default value is ['id']. For more information: https://www.houdinigraphql.com/guides/caching-data#custom-ids
	 */
	defaultKeys?: string[]

	/**
	 * An object that customizes the resolution behavior for a specific type. For more information: https://www.houdinigraphql.com/guides/caching-data#custom-ids
	 */
	types?: TypeConfig

	/**
	 * Controls how much houdini logs during codegen. One of "quiet", "summary",
	 * "short-summary", or "full". Defaults to "summary".
	 */
	logLevel?: import('./types.js').LogLevel

	/**
	 * A flag to specify the default fragment masking behavior.
	 * @default `enable`
	 */
	defaultFragmentMasking?: 'enable' | 'disable'

	/**
	 * The URL the CLIENT sends GraphQL requests to. Set this when the API is REMOTE; the client
	 * queries it directly and `@session` mutations are proxied through Houdini to it. It's public
	 * (it ships in the client bundle), so switch it per environment with `import.meta.env`, e.g.
	 * `import.meta.env.VITE_API_URL ?? 'http://localhost:4000/graphql'`. With a local
	 * `src/server/+schema` you can leave this unset — it's inferred from the server `endpoint`.
	 */
	url?: string

	/**
	 * Configure the dev environment to watch a remote schema for changes. When omitted, `url` is
	 * used as the introspection endpoint. Set to `false` (or `null`) to disable schema polling and
	 * introspection entirely, even when `url` is set.
	 */
	watchSchema?: WatchSchemaConfig | false | null

	/**
	 * Specifies the the persisted queries path and file. (default: `<rootDir>/persisted_queries.json`)
	 */
	persistedQueriesPath?: string

	/**
	 * An object describing the plugins enabled for the project
	 */
	plugins?: HoudiniPluginConfig

	/**
	 * The relative path from your houdini config file pointing to your application.
	 * @default process.cwd()
	 */
	projectDir?: string

	/**
	 * The relative path from your project directory pointing to your output directory.
	 * @default `$houdini`
	 */
	runtimeDir?: string

	/**
	 * Transport used between the Node.js orchestrator and plugin processes.
	 * 'stdio' routes all communication over stdin/stdout (required for WASI plugins).
	 * @default 'websocket'
	 */
	pluginTransport?: 'websocket' | 'stdio' | `env:${string}`

	/**
	 * Configure the router to evaluate custom scalars using runtime values
	 */
	runtimeScalars?: Record<
		string,
		{
			// the equivalent GraphQL type
			type: string
			// the function to call that serializes the type for the API
			resolve: (args: RuntimeScalarPayload) => any
		}
	>
}

export type RuntimeScalarPayload = {
	session?: App.Session | null | undefined
}

// a single-use store for relayed session-mint token ids (jti). `consume` atomically records the id
// with the given time-to-live and returns true only if it had not been recorded before; a false
// return means the token was already consumed (a replay) and must be rejected.
export type ConsumedTokenStore = {
	consume(jti: string, ttlMs: number): boolean | Promise<boolean>
}

// ServerConfigFile is the server-only configuration written in src/server/+config. src/server is
// compiled into the server bundle only, never the client. Holds the session signing keys, OAuth
// providers, onSignIn, and the GraphQL `endpoint`. Kept as a type SEPARATE from the public,
// client-bundled ConfigFile. Codegen bakes the client-relevant `endpoint` into the bundle; the
// session `auth.url` is injected at render.
export type ServerConfigFile = {
	auth?: {
		// signing keys for the session cookie, the form CSRF token, and the @session relay token.
		// The first key signs; any others are accepted on verify (key rotation).
		sessionKeys?: string[]
		// The endpoint that sets the session cookie. Defaults to '/_auth' and is always
		// mounted for the POST relay used by progressively-enhanced `@session` forms and
		// useSession(). Must be a relative path (leading slash). Injected to the client at render.
		url?: string
		// the redirect-login escape hatch. Set `url` to a TRUSTED integration's login endpoint (an
		// OAuth worker you operate) to enable the `/login` -> integration -> callback flow: the
		// integration runs the provider OAuth and redirects back with a session token signed with
		// the shared `sessionKeys`, while Houdini binds the round-trip to the initiating browser
		// with a single-use nonce. Omit to leave the redirect flow disabled.
		redirect?: { url: string }
		// first-class OAuth: a map of provider name → configured adapter (from `houdini/oauth`, e.g.
		// `github({ clientId, clientSecret })`). The keys become the typed `provider` argument of
		// `loginURL` and the `?provider=` value `/login` dispatches on. Houdini runs the Auth Code +
		// PKCE flow against the provider directly (no external worker needed).
		providers?: Record<string, OAuthProvider>
		// called server-side after a successful OAuth callback, with the validated user and the
		// provider tokens; its return value becomes the session. Persist the provider tokens in your
		// own database here — the session cookie should hold only an opaque value (e.g. { userId }).
		onSignIn?: (args: {
			provider: string
			user: OAuthUser
			tokens: OAuthTokens
		}) => App.Session | Promise<App.Session>
		// single-use enforcement for relayed @session mint tokens. Each token carries a unique `jti`
		// that must be consumed exactly once to block replay. The default store is an in-memory Map,
		// which is per-process — so on a MULTI-INSTANCE / serverless deployment a token could be
		// replayed on another instance within its short TTL. Provide a shared store (Redis, a DB, a
		// Durable Object) to enforce single-use across instances. `consume` must atomically record the
		// jti and return true only if it had not been seen before (e.g. Redis `SET jti 1 NX PX ttl`).
		consumedTokenStore?: ConsumedTokenStore
	}
	// where the GraphQL API is served. Defaults to '/_api'; set it to override that path. Codegen
	// bakes the value into the client so the client knows where to send when houdini.config has no
	// `url`. As server-only Node config it can read `process.env` directly.
	endpoint?: string
	// extra origins (beyond the app's own) allowed to POST to the no-JS form endpoint. The form
	// handler's CSRF check is fail-closed: a form POST whose Origin is absent or matches neither
	// the request's own origin nor this allowlist is rejected (403). Server-only.
	allowedOrigins?: string[]
	// max size (bytes) of a no-JS form POST body, rejected (413) before the body is buffered.
	// Defaults to 10 MB. Bodies without a Content-Length fall back to the host/proxy limit.
	// Server-only.
	formMaxBodyBytes?: number
}

type ScalarMap = { [typeName: string]: ScalarSpec }

export type TypeConfig = {
	[typeName: string]: {
		keys?: string[]
		resolve?: {
			queryField: string
			arguments?: (data: any) => { [key: string]: any }
		}
	}
}

export type WatchSchemaConfig = {
	/**
	 * A url to use to pull the schema. For more information: https://www.houdinigraphql.com/api/cli#generate
	 * Defaults to the top-level `url` when omitted.
	 */
	url?: string | ((env: Record<string, string | undefined>) => string)

	/**
	 * sets the amount of time between each request in milliseconds (default 2 seconds).
	 * To limit the schema introspection to just on the start of the server, set interval to 0.
	 * To disable the schema introspection, set interval to null.
	 */
	interval?: number | null

	/**
	 * Sets a custom timeout in milliseconds which is used to cancel fetching the schema. If the timeout is reached
	 * before the remote API has responded, the request is cancelled and an error is displayed.
	 * The default is 30 seconds (30000 milliseconds)
	 */
	timeout?: number | null

	/**
	 * An object containing the environment variables you want passed onto the api when polling for a new schema.
	 * The keys dictate the header names. If the value is a string, the corresponding environment variable will be used
	 * directly. If the value is a function, the current environment will be passed to your function so you can perform any
	 * logic you need
	 */
	headers?:
		| Record<string, string | ((env: Record<string, string | undefined>) => string)>
		| ((env: Record<string, string | undefined>) => Record<string, string>)

	/**
	 * When set to false, the pulled schema will not be written to disk.
	 * Useful when schemaPath is a glob pointing to multiple files.
	 * Defaults to true.
	 */
	writePolledSchema?: boolean
}

export type ScalarSpec = {
	// the type to use at runtime
	type: string
	// the types that should be considered valid input types
	inputTypes?: Array<'Int' | 'Float' | 'String' | 'Boolean' | 'ID'>
	// the function to call that serializes the type for the API. If you are using this
	// scalar as the input to a query through a route parameter, this function will receive
	// the value as a string in addition to your complex value.
	marshal?: (val: any) => any
	// the function to call that turns the API's response into _ClientType
	unmarshal?: (val: any) => any
	// the npm module to import the type from in generated artifact type files
	module?: string
	// when true, the type is imported as the default export of the module
	// e.g. { type: 'MyDate', module: './my-date', default: true } → import type MyDate from './my-date'
	// when false or absent, it is imported as a named export
	// e.g. { type: 'Temporal', module: 'temporal-polyfill' } → import type { Temporal } from 'temporal-polyfill'
	default?: boolean
}

// this type is meant to be extended by plugins to provide type definitions
// for config
export interface HoudiniPluginConfig {}

// this type is meant to be extended by client plugins to provide type definitions
// for config
export interface HoudiniClientPluginConfig {}

// we need to include some extra meta data along with the config file
export class Config {
	public config_file: ConfigFile
	// server_config is the server-only overlay loaded from src/server/+config (secrets like
	// sessionKeys). Kept separate from config_file so it never flows into the client bundle.
	public server_config: ServerConfigFile
	public filepath: string
	public plugins: PluginMeta[]
	public root_dir: string
	public schema: GraphQLSchema

	constructor(init: {
		config_file: ConfigFile
		server_config?: ServerConfigFile
		filepath: string
		plugins: PluginMeta[]
		root_dir: string
		schema: GraphQLSchema
	}) {
		this.config_file = init.config_file
		this.server_config = init.server_config ?? {}
		this.filepath = init.filepath
		this.plugins = init.plugins
		this.root_dir = init.root_dir
		this.schema = init.schema
	}

	schema_path() {
		return this.config_file.schemaPath ?? path.resolve(process.cwd(), 'schema.json')
	}

	async api_url() {
		const watchSchema = this.config_file.watchSchema
		// `false`/`null` disables schema polling + introspection entirely
		if (watchSchema === false || watchSchema === null) {
			return ''
		}
		// the introspection endpoint: watchSchema.url when set, otherwise the top-level `url`
		const apiURL = watchSchema?.url ?? this.config_file.url
		if (!apiURL) {
			return ''
		}

		return this.process_env_values(process.env, apiURL)
	}

	get include(): Array<string> {
		// if the config file has one, use it
		if (this.config_file.include) {
			return Array.isArray(this.config_file.include)
				? this.config_file.include
				: [this.config_file.include]
		}

		// by default, any file of a valid extension in src is good enough
		const include = [`src/**/*`]

		// if any of the plugins specify included runtimes then their paths might have
		// documents
		for (const plugin of this.plugins) {
			const runtimeDir = path.join(plugin_dir(this, plugin.name), 'runtime')
			const staticDir = path.join(plugin_dir(this, plugin.name), 'static')

			// skip plugins that dont' include runtimes
			if (!runtimeDir && !staticDir) {
				continue
			}

			for (const dir of [runtimeDir, staticDir]) {
				if (!dir) {
					continue
				}

				// the include path is relative to root of the vite project
				const includePath = path.relative(this.root_dir, dir)

				// add the plugin's directory to the include pile
				include.push(`${includePath}/**/*`)
			}
		}

		return include
	}

	includeFile(
		filepath: string,
		{ root = this.root_dir }: { root?: string; ignore_plugins?: boolean } = {}
	) {
		const parsed = path.parse(filepath)
		filepath = `${parsed.dir}/${parsed.name}${parsed.ext.split('?')[0]}`

		const included = false
		// if the filepath doesn't match the include we're done
		if (
			!included &&
			!this.include.some((pattern) => minimatch(filepath, path.join(root, pattern)))
		) {
			return false
		}

		// if there is an exclude, make sure the path doesn't match any of the exclude patterns
		return !this.excludeFile(filepath, { root })
	}

	get exclude(): Array<string> {
		// if there is nothing specified we'll use an empty array
		if (!this.config_file.exclude) {
			return []
		}

		return Array.isArray(this.config_file.exclude)
			? this.config_file.exclude
			: [this.config_file.exclude]
	}

	excludeFile(filepath: string, { root = this.root_dir }: { root?: string }) {
		// if the configured exclude does not allow this file, we're done
		if (
			this.exclude.length > 0 &&
			this.exclude.some((pattern) => minimatch(filepath, path.join(root, pattern)))
		) {
			return true
		}

		// if we got this far, we shouldn't exclude
		return false
	}

	async schema_pull_headers() {
		const env = process.env

		// if the whole thing is a function, just call it (|| undefined coerces false/null away)
		const config_headers = (this.config_file.watchSchema || undefined)?.headers
		if (typeof config_headers === 'function') {
			return config_headers(env)
		}

		// we need to turn the map into the correct key/value pairs
		const headers = Object.fromEntries(
			Object.entries(config_headers || {})
				.map(([key, value]) => {
					const headerValue = this.process_env_values(env, value)

					// if there was no value, dont add anything
					if (!headerValue) {
						return []
					}

					return [key, headerValue]
				})
				.filter(([key]) => key)
		)

		// we're done
		return headers
	}

	process_env_values(
		env: Record<string, string | undefined>,
		value: string | ((env: any) => string)
	) {
		let headerValue: string | undefined
		if (typeof value === 'function') {
			headerValue = value(env)
		} else if (value.startsWith('env:')) {
			headerValue = env[value.slice('env:'.length)]
		} else {
			headerValue = value
		}

		return headerValue
	}

	get artifact_dir() {
		return path.join(this.root_dir, this.config_file.runtimeDir || '.houdini', 'artifacts')
	}

	get routes_dir() {
		return path.join(this.root_dir, 'src', 'routes')
	}

	// the location of the artifact generated corresponding to the provided documents
	artifactPath(document: graphql.DocumentNode): string {
		// use the operation name for the artifact
		return path.join(this.artifact_dir, `${documentName(document)}.js`)
	}

	pluginConfig<ConfigType extends {}>(name: string): ConfigType {
		// @ts-expect-error
		return (this.config_file.plugins?.[name] as ConfigType) ?? {}
	}
}

function documentName(document: graphql.DocumentNode) {
	// if there is an operation in the document
	const operation = document.definitions.find(
		({ kind: _kind }) => graphql.Kind.OPERATION_DEFINITION
	) as graphql.OperationDefinitionNode | null
	if (operation) {
		// if the operation does not have a name
		if (!operation.name) {
			// we can't give them a file
			throw new Error(`encountered operation with no name: ${graphql.print(document)}`)
		}

		// use the operation name for the artifact
		return operation.name.value
	}

	// look for a fragment definition
	const fragmentDefinitions = document.definitions.filter(
		({ kind }) => kind === graphql.Kind.FRAGMENT_DEFINITION
	) as graphql.FragmentDefinitionNode[]
	if (fragmentDefinitions.length) {
		// join all of the fragment definitions into one
		return fragmentDefinitions.map((fragment) => fragment.name).join('_')
	}

	// we don't know how to generate a name for this document
	throw new Error(`Could not generate artifact name for document: ${graphql.print(document)}`)
}
