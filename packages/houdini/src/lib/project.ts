import { mergeSchemas } from '@graphql-tools/schema'
import { GraphQLSchema } from 'graphql'
import * as graphql from 'graphql'

import type { ConfigFile } from '../runtime/lib/config'
import { local_api_dir, temp_dir } from './conventions'
import { HoudiniError } from './error'
import * as fs from './fs'
import * as path from './path'

export type { ConfigFile } from '../runtime/lib/config'

const DEFAULT_CONFIG_PATH = path.join(process.cwd(), 'houdini.config.js')

export type PluginMeta = {
	name: string
	options: Record<string, any>
	filepath: string
}

// we need to include some extra meta data along with the config file
export type Config = {
	config_file: ConfigFile
	filepath: string
	local_schema: boolean
	plugins: PluginMeta[]
	root_dir: string
	schema?: GraphQLSchema
}

// a place to store the current configuration
let _config: Config

// if multiple calls to getConfig happen simultaneously, we want to only load the
// schema once (if it needs to happen, ie the file doesn't exist).
let pending_config_promises: Promise<Config> | null = null

// get the project's current configuration
export async function get_config(
	{
		config_path = DEFAULT_CONFIG_PATH,
		force_reload,
		schema,
	}: {
		config_path: string
		force_reload?: boolean
		schema?: GraphQLSchema
	} = { config_path: DEFAULT_CONFIG_PATH }
): Promise<Config> {
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
		const config_file = await readConfigFile(config_path)
		_config = {
			config_file,
			filepath: config_path,
			local_schema: false,
			plugins: [],
			root_dir: path.dirname(
				config_file.projectDir
					? path.join(process.cwd(), config_file.projectDir)
					: config_path
			),
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

		// if there is a local schema then we need to ignore the schema check
		try {
			for (const child of await fs.readdir(local_api_dir(_config))) {
				if (path.parse(child).name === '+schema') {
					_config.local_schema = true
					break
				}
			}
		} catch {}

		// if we have a local schema, then we should just build it if we haven't
		if (_config.local_schema) {
			_config.schema = await load_local_schema(_config)
		}
		// if we have a schema path then we need to load it
		else if (_config.config_file.schemaPath) {
			_config.schema = await load_schema_file(_config.config_file.schemaPath)
		}

		// order the list of plugins
		_config.plugins = await Promise.all(
			plugins.map(async ([name, options]) => ({
				name,
				options,
				filepath: await plugin_path(name, config_path),
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
async function readConfigFile(configPath: string = DEFAULT_CONFIG_PATH): Promise<ConfigFile> {
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
	return config
}

async function plugin_path(plugin_name: string, config_path: string): Promise<string> {
	try {
		// check if we are in a PnP environment
		if (process.versions.pnp) {
			// retrieve the PnP API (Yarn injects the `findPnpApi` into `node:module` builtin module in runtime)
			const { findPnpApi } = require('node:module')

			// this will traverse the file system to find the closest `.pnp.cjs` file and return the PnP API based on it
			// normally it will reside at the same level with `houdini.config.js` file, so it is unlikely that traversing the whole file system will happen
			const pnp = findPnpApi(config_path)

			// this directly returns the ESM export of the corresponding module, thanks to the PnP API
			// it will throw if the module isn't found in the project's dependencies
			return pnp.resolveRequest(plugin_name, config_path, { conditions: new Set(['import']) })
		}

		// otherwise we have to hunt the module down relative to the current path
		const pluginDirectory = findModule(plugin_name, config_path)

		// load up the package json
		const packageJsonSrc = await fs.readFile(path.join(pluginDirectory, 'package.json'))
		if (!packageJsonSrc) {
			throw new Error('skip')
		}
		const packageJSON = JSON.parse(packageJsonSrc)

		// the esm target to import is defined at exports['.'].import
		if (!packageJSON.exports?.['.']?.import) {
			throw new Error('')
		}

		return path.join(pluginDirectory, packageJSON.exports['.'].import)
	} catch {
		const err = new Error(
			`Could not find plugin: ${plugin_name}. Are you sure its installed? If so, please open a ticket on GitHub.`
		)

		throw err
	}
}

function findModule(pkg: string = 'houdini', currentLocation: string) {
	const pathEndingBy = ['node_modules', pkg]

	// Build the first possible location
	let locationFound = path.join(currentLocation, ...pathEndingBy)

	// previousLocation is nothing
	let previousLocation = ''
	const backFolder: string[] = []

	// if previousLocation !== locationFound that mean that we can go upper
	// if the directory doesn't exist, let's go upper.
	while (previousLocation !== locationFound && !fs.existsSync(locationFound)) {
		// save the previous path
		previousLocation = locationFound

		// add a back folder
		backFolder.push('../')

		// set the new location
		locationFound = path.join(currentLocation, ...backFolder, ...pathEndingBy)
	}

	if (previousLocation === locationFound) {
		throw new Error('Could not find any node_modules/houdini folder')
	}

	return locationFound
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

export function is_secondary_build() {
	return process.env.HOUDINI_SECONDARY_BUILD && process.env.HOUDINI_SECONDARY_BUILD !== 'false'
}

export function internal_routes(config: Config): string[] {
	const routes = [local_api_dir(config)]
	if (config.config_file.router?.auth && 'redirect' in config.config_file.router.auth) {
		routes.push(config.config_file.router.auth.redirect)
	}

	return routes
}

export async function build_local_schema(config: Config): Promise<void> {
	// before we build the local schcema, we should check if it already exists
	// so we dont do it again

	// load the current version of vite
	const { build } = await import('vite')

	const schema = path.join(local_api_dir(config), '+schema')
	const outDir = temp_dir(config, 'schema')

	process.env.HOUDINI_SECONDARY_BUILD = 'true'

	try {
		await fs.remove(path.join(outDir, 'assets', 'schema.js'))
	} catch {}

	try {
		await fs.mkdir(outDir)
	} catch {}

	// build the schema somewhere we can import from
	await build({
		logLevel: 'silent',
		build: {
			outDir,
			rollupOptions: {
				input: {
					schema,
				},
				output: {
					entryFileNames: '[name].js',
				},
			},
			ssr: true,
			lib: {
				entry: {
					schema,
				},
				formats: ['es'],
			},
		},
	})

	process.env.HOUDINI_SECONDARY_BUILD = 'false'
}

export async function load_local_schema(config: Config): Promise<graphql.GraphQLSchema> {
	if (!is_secondary_build()) {
		await build_local_schema(config)
	}

	// import the schema we just built
	try {
		const { default: schema } = await import(
			path.join(temp_dir(config, 'schema'), `schema.js?${Date.now().valueOf()}}`)
		)

		return schema
	} catch (e) {
		const message = 'message' in (e as Error) ? (e as Error).message : e
		// if we fail to load the schema, log a message to the user and just return an empty one
		console.error('⚠️ Failed to load local schema: ', message)
		return new graphql.GraphQLSchema({})
	}
}
