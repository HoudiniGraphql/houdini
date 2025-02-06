import { mergeSchemas } from '@graphql-tools/schema'
import { GraphQLSchema } from 'graphql'
import * as graphql from 'graphql'

import type { ConfigFile } from '../runtime/lib/config'
import { local_api_dir, temp_dir } from './conventions'
import { HoudiniError } from './error'
import * as fs from './fs'
import * as path from './path'
import { plugin_path } from './plugins'

export type { ConfigFile } from '../runtime/lib/config'

export type PluginMeta = {
	name: string
	options: Record<string, any>
	executable: string
}

// we need to include some extra meta data along with the config file
export type Config = {
	config_file: ConfigFile
	filepath: string
	plugins: PluginMeta[]
	root_dir: string
	schema: GraphQLSchema
}

export const default_config: ConfigFile = {
	schemaPath: './.houdini/schema.graphql',
	runtimeDir: '.houdini',
	cacheBufferSize: 10,
	defaultKeys: ['id'],
}

// a place to store the current configuration
let _config: Config

// if multiple calls to getConfig happen simultaneously, we want to only load the
// schema once (if it needs to happen, ie the file doesn't exist).
let pending_config_promises: Promise<Config> | null = null

// get the project's current configuration
export async function get_config({
	force_reload,
	schema,
	config_path: _config_path,
}: {
	config_path?: string
	force_reload?: boolean
	schema?: GraphQLSchema
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

	config_path = config_path!

	// there isn't a pending config so let's make one to claim
	let resolve: (cfg: Config | PromiseLike<Config>) => void = () => {}
	let reject = (message?: any) => {}
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
			for (const child of await fs.readdir(local_api_dir(_config, root_dir))) {
				if (path.parse(child).name === '+schema') {
					local_schema = path.join(local_api_dir(_config, root_dir), child)
					break
				}
			}
		} catch {}

		_config = {
			root_dir,
			config_file,
			filepath: config_path,
			schema: local_schema
				? await load_local_schema(local_schema)
				: await load_schema_file(config_file.schemaPath),
			plugins: [],
		}

		// we need to process the plugins before we instantiate the config object
		// so that we can compute the final config_file

		// the list of plugins comes from two places:
		// - the config file
		// - the value of the HOUDINI_CODEGEN_PLUGIN environment variable
		const plugins = Object.entries(config_file.plugins ?? {})

		// we need to add the codegen plugin to the list
		plugins.push(['houdini-core', {}])

		// if the environment variable is defined, add it to the list
		if (process.env.HOUDINI_CODEGEN_PLUGIN) {
			plugins.push([process.env.HOUDINI_CODEGEN_PLUGIN, {}])
		}

		// order the list of plugins
		_config.plugins = await Promise.all(
			plugins.map(async ([name, options]) => ({
				name,
				options,
				executable: await plugin_path(name, config_path),
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
async function read_config_file(configPath: string): Promise<ConfigFile> {
	// on windows, we need to prepend the right protocol before we
	// can import from an absolute path
	let importPath = path.importPath(configPath)

	let imported: any
	try {
		imported = await import(/* @vite-ignore */ importPath)
	} catch (e: any) {
		throw new Error(`Could not load config file at file://${configPath}.\n${e.message}`)
	}

	// if this is wrapped in a default, use it
	const config = imported.default || imported
	return {
		...default_config,
		...config,
	}
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

const emptySchema = graphql.buildSchema('type Query { hello: String }')
const defaultDirectives = emptySchema.getDirectives().map((dir) => dir.name)

export function internal_routes(config: Config): string[] {
	const routes = [local_api_dir(config)]
	if (config.config_file.router?.auth && 'redirect' in config.config_file.router.auth) {
		routes.push(config.config_file.router.auth.redirect)
	}

	return routes
}

export async function load_local_schema(schema_path: string): Promise<graphql.GraphQLSchema> {
	// import the schema we just built
	try {
		const { default: schema } = await import(schema_path)

		return schema
	} catch (e) {
		const message = 'message' in (e as Error) ? (e as Error).message : e
		// if we fail to load the schema, log a message to the user and just return an empty one
		console.error('⚠️ Failed to load local schema: ', message)
		return new graphql.GraphQLSchema({})
	}
}
