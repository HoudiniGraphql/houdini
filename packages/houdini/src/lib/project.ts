import { mergeSchemas } from '@graphql-tools/schema'
import { transform } from 'esbuild'
import * as graphql from 'graphql'
import { pathToFileURL } from 'node:url'

import { DEFAULT_AUTH_URL } from '../runtime/config.js'
import { houdini_root, local_server_dir } from '../router/conventions.js'
import { Config, type ConfigFile, type ServerConfigFile } from './config.js'
import { HoudiniError } from './error.js'
import * as fs from './fs.js'
import * as path from './path.js'
import { plugin_path } from './plugins.js'

export type { ConfigFile } from './config.js'

export type PluginMeta = {
	name: string
	config: Record<string, any>
	executable: string
	directory: string
}

export const default_config: ConfigFile = {
	schemaPath: '.houdini/schema.graphql',
	include: ['src/**/*'],
	runtimeDir: '.houdini',
	cacheBufferSize: 10,
	defaultKeys: ['id'],
	defaultPaginateMode: 'Infinite',
	defaultFragmentMasking: 'enable',
	defaultCachePolicy: 'CacheOrNetwork',
}

// a place to store the current configuration
let _config: Config

// if multiple calls to getConfig happen simultaneously, we want to only load the
// schema once (if it needs to happen, ie the file doesn't exist).
let pending_config_promises: Promise<Config> | null = null

// get the project's current configuration
export async function get_config({
	force_reload,
	config_path: _config_path,
	skip_schema,
}: {
	config_path?: string
	force_reload?: boolean
	skip_schema?: boolean
} = {}): Promise<Config> {
	let config_path = _config_path ?? ''

	// if we force a reload, we will bypass this part
	if (!force_reload) {
		if (_config) {
			return _config
		}

		// if we have a pending promise, return the result of that
		if (pending_config_promises) {
			return await pending_config_promises
		}
	}

	// we need to figure out the config path
	if (!config_path) {
		config_path = path.resolve(process.cwd(), 'houdini.config.js')
		// the config file could also be defined as typescript
		try {
			await fs.stat(config_path)
		} catch {
			config_path = path.resolve(process.cwd(), 'houdini.config.ts')
			try {
				await fs.stat(config_path)
			} catch {
				throw new HoudiniError({
					message: `Could not find a config file`,
				})
			}
		}
	}

	// there isn't a pending config so let's make one to claim
	let resolve: (cfg: Config | PromiseLike<Config>) => void = () => {}
	let reject = (_message?: any) => {}
	pending_config_promises = new Promise((res, rej) => {
		resolve = res
		reject = rej
	})

	// wrap the rest of the function so that errors resolve the promise as well
	try {
		// look up the current config file
		const config_file = await read_config_file(config_path)
		if (!config_file.schemaPath) {
			throw new HoudiniError({
				message: `Config file must include a 'schemaPath' field`,
			})
		}

		const root_dir = path.dirname(
			config_file.projectDir ? path.join(process.cwd(), config_file.projectDir) : config_path
		)

		// if there is a local schema then we need to ignore the schema check
		let local_schema = ''
		try {
			for (const child of await fs.readdir(local_server_dir(_config, root_dir))) {
				if (path.parse(child).name === '+schema') {
					local_schema = path.join(local_server_dir(_config, root_dir), child)
					break
				}
			}
		} catch {}

		// load the server-only config (src/server/+config) — secrets like sessionKeys that must never
		// reach the client. Kept separate from config_file (which the client bundles) so it can't
		// leak; every server/build consumer reads config.server_config explicitly.
		const server_config = await read_server_config(
			local_server_dir(_config, root_dir),
			root_dir
		)

		const partialConfig: Partial<Config> = {
			root_dir,
			config_file,
			server_config,
			filepath: config_path,
			plugins: [],
		}

		fs.mkdirpSync(houdini_root(partialConfig as Config))

		_config = new Config({
			...(partialConfig as Config),
		})

		// when we're pulling the schema, we don't yet have a schema to read.
		if (!skip_schema) {
			_config.schema = local_schema
				? await load_local_schema(config_file, local_schema)
				: await load_schema_file(config_file.schemaPath)
		}

		// we need to process the plugins before we instantiate the config object
		// so that we can compute the final config_file

		// the list of plugins comes from two places:
		// - the config file
		// - the value of the HOUDINI_CODEGEN_PLUGIN environment variable
		const plugins = Object.entries(config_file.plugins ?? {})

		// we need to add the codegen plugin to the list
		plugins.unshift(['houdini-core', {}])

		// if the environment variable is defined, add it to the list
		if (process.env.HOUDINI_CODEGEN_PLUGIN) {
			plugins.push([process.env.HOUDINI_CODEGEN_PLUGIN, {}])
		}

		// order the list of plugins
		const preferWasm =
			process.env.HOUDINI_PLATFORM === 'wasm' || config_file.pluginTransport === 'stdio'
		_config.plugins = await Promise.all(
			plugins.map(async ([name, config]) => ({
				name,
				config,
				...(await plugin_path(name, config_path, preferWasm)),
			}))
		)

		// we're done and have a valid config
		resolve(_config)
		return _config

		// error handling
	} catch (e) {
		reject(e)
		throw e
	}
}

// helper function to load the config file
// the env-var prefix exposed to the config, mirroring Vite. ONLY keys with this prefix are
// substituted into import.meta.env — never the rest of process.env — because houdini.config is also
// bundled into the client, so exposing unprefixed vars would leak server secrets into the browser.
const ENV_PREFIX = 'VITE_'

// parse_env_file is a minimal .env parser (KEY=value, # comments, optional surrounding quotes).
// Enough for the prefixed string vars we expose; it intentionally does not do dotenv-expand.
function parse_env_file(contents: string): Record<string, string> {
	const out: Record<string, string> = {}
	for (const line of contents.split('\n')) {
		const trimmed = line.trim()
		if (!trimmed || trimmed.startsWith('#')) {
			continue
		}
		const eq = trimmed.indexOf('=')
		if (eq === -1) {
			continue
		}
		const key = trimmed.slice(0, eq).trim()
		let value = trimmed.slice(eq + 1).trim()
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1)
		}
		out[key] = value
	}
	return out
}

// collect_env_files reads the project's .env files in Vite's precedence order and returns the
// merged key/value set (no prefix filtering — callers decide what to expose where).
async function collect_env_files(root: string): Promise<Record<string, string>> {
	const mode = process.env.NODE_ENV || 'development'
	const collected: Record<string, string> = {}
	// Vite precedence: .env < .env.local < .env.[mode] < .env.[mode].local
	for (const file of ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]) {
		const contents = await fs.readFile(path.join(root, file))
		if (contents) {
			Object.assign(collected, parse_env_file(contents))
		}
	}
	return collected
}

// load_vite_env reproduces Vite's loadEnv for the VITE_ prefix so that `houdini generate` (plain
// node, no Vite) sees the same import.meta.env a Vite run would: the project's .env files plus the
// prefixed shell env, shell winning. Restricted to the prefix so secrets never reach the client.
export async function load_vite_env(configPath: string): Promise<Record<string, string>> {
	const collected = await collect_env_files(path.dirname(configPath))
	// shell env wins over .env files
	for (const [key, value] of Object.entries(process.env)) {
		if (value !== undefined && key.startsWith(ENV_PREFIX)) {
			collected[key] = value
		}
	}
	const exposed: Record<string, string> = {}
	for (const [key, value] of Object.entries(collected)) {
		if (key.startsWith(ENV_PREFIX)) {
			exposed[key] = value
		}
	}
	return exposed
}

// load_env_files populates process.env from the project's .env files WITHOUT the VITE_ prefix
// restriction — the shell still wins (existing keys are never overwritten). This only runs for
// the server-only config (src/server/+config), which never reaches a client bundle, so it's the
// natural home for secrets: the same public/private split as SvelteKit's $env/static/private.
// Client-visible env stays VITE_-prefixed through load_vite_env above.
export async function load_env_files(rootDir: string): Promise<void> {
	for (const [key, value] of Object.entries(await collect_env_files(rootDir))) {
		if (process.env[key] === undefined) {
			process.env[key] = value
		}
	}
}

export async function read_config_file(configPath: string): Promise<ConfigFile> {
	let imported: any

	// fast path: a config that doesn't reference import.meta.env loads exactly as before (plain
	// dynamic import, which handles both CJS and ESM). This keeps every existing config untouched.
	const source = await fs.readFile(configPath)
	if (source !== null && source.includes('import.meta.env')) {
		// import.meta.env is Vite's env; plain node leaves it undefined, so `import.meta.env.VITE_FOO`
		// would throw on import. Reproduce esbuild's `define` (what a Vite run does) by substituting
		// import.meta.env with the resolved values before importing. This is a single-file source
		// transform — no bundling or module resolution. Only ESM can use import.meta.env, so the
		// transformed output is written as a sibling .mjs (its own imports resolve from there).
		const mode = process.env.NODE_ENV || 'development'
		const meta_env = {
			...(await load_vite_env(configPath)),
			MODE: mode,
			DEV: mode !== 'production',
			PROD: mode === 'production',
			SSR: true,
			BASE_URL: '/',
		}
		let tmpPath = ''
		try {
			const { code } = await transform(source, {
				loader: configPath.endsWith('.ts') ? 'ts' : 'js',
				format: 'esm',
				define: { 'import.meta.env': JSON.stringify(meta_env) },
			})
			tmpPath = `${configPath}.houdini-${Date.now()}-${process.pid}.mjs`
			await fs.writeFile(tmpPath, code)
			imported = await import(/* @vite-ignore */ path.importPath(tmpPath))
		} catch (e: any) {
			throw new Error(`Could not load config file at file://${configPath}.\n${e.message}`)
		} finally {
			if (tmpPath) {
				await fs.remove(tmpPath).catch(() => {})
			}
		}
	} else {
		try {
			// on windows, we need to prepend the right protocol before we
			// can import from an absolute path
			imported = await import(/* @vite-ignore */ path.importPath(configPath))
		} catch (e: any) {
			throw new Error(`Could not load config file at file://${configPath}.\n${e.message}`)
		}
	}

	// if this is wrapped in a default, use it
	const config = imported.default || imported
	return {
		...default_config,
		...config,
	}
}

// read_server_config loads the server-only config overlay (src/server/+config). Returns {} when the
// file is absent. It holds secrets (sessionKeys, later oauth) and lives in src/server, which is
// compiled server-side only — so it never reaches the client bundle.
async function read_server_config(serverDir: string, rootDir: string): Promise<ServerConfigFile> {
	let configPath = ''
	try {
		for (const child of await fs.readdir(serverDir)) {
			if (path.parse(child).name === '+config') {
				configPath = path.join(serverDir, child)
				break
			}
		}
	} catch {
		return {} // server dir doesn't exist
	}
	if (!configPath) {
		return {}
	}

	// the server config is the one place secrets belong, so give it the full .env set (via
	// process.env) before importing — the values a Vite run withholds from import.meta.env
	await load_env_files(rootDir)

	let imported: any
	try {
		imported = await import(/* @vite-ignore */ path.importPath(configPath))
	} catch (e: any) {
		throw new Error(`Could not load server config at file://${configPath}.\n${e.message}`)
	}
	return (imported.default ?? imported) as ServerConfigFile
}

async function load_schema_file(schemaPath: string): Promise<graphql.GraphQLSchema> {
	// if the schema is not a relative path, the config file is out of date
	if (path.isAbsolute(schemaPath)) {
		// compute the new value for schema
		const relPath = path.relative(process.cwd(), schemaPath)

		// build up an error with no stack trace so the message isn't so noisy
		const error = new Error(
			`Invalid config value: 'schemaPath' must now be passed as a relative directory. Please change ` +
				`its value to "./${relPath}".`
		)
		error.stack = ''

		// don't let anything continue
		throw error
	}

	// if the path is a glob, load each file
	if (fs.glob.hasMagic(schemaPath)) {
		// the first step we have to do is grab a list of every file in the source tree
		const sourceFiles = await fs.glob(schemaPath)

		return mergeSchemas({
			typeDefs: await Promise.all(
				sourceFiles.map(async (filepath: string) => (await fs.readFile(filepath))!)
			),
		})
	}

	// the path has no glob magic, make sure its a real file
	try {
		await fs.stat(schemaPath)
	} catch {
		throw new HoudiniError({
			message: `Schema file does not exist! Create it using houdini pull-schema`,
		})
	}

	const contents = (await fs.readFile(schemaPath))!

	// if the schema points to an sdl file
	if (
		schemaPath.endsWith('gql') ||
		schemaPath.endsWith('graphql') ||
		schemaPath.endsWith('graphqls')
	) {
		return graphql.buildSchema(contents)
	}

	// the schema must point to a json blob (with data level or content of data directly)
	const jsonContents = JSON.parse(contents)
	if (jsonContents.data) {
		return graphql.buildClientSchema(jsonContents.data)
	}
	return graphql.buildClientSchema(jsonContents)
}

export function internal_routes(config: Config): string[] {
	const routes = [local_server_dir(config)]
	// the auth endpoint is always mounted (default path when unconfigured), so register it as an
	// internal route rather than a 404. Its url is server-only config now.
	routes.push(config.server_config.auth?.url ?? DEFAULT_AUTH_URL)

	return routes
}

export async function load_local_schema(
	config: ConfigFile,
	schema_path: string
): Promise<graphql.GraphQLSchema> {
	// import the schema we just built
	try {
		const { default: schema } = await import(pathToFileURL(schema_path).toString())

		// now that we have the schema, let's write it to disk so the core plugin
		// can import it
		await fs.writeFile(config.schemaPath!, graphql.printSchema(schema))

		return schema
	} catch (e) {
		const message = 'message' in (e as Error) ? (e as Error).message : e
		// if we fail to load the schema, log a message to the user and just return an empty one
		console.error('! Failed to load local schema: ', message)
		return new graphql.GraphQLSchema({})
	}
}
