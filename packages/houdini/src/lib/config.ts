import { mergeSchemas } from '@graphql-tools/schema'
import * as graphql from 'graphql'
import minimatch from 'minimatch'
import type {
	CustomPluginOptions,
	LoadResult,
	ObjectHook,
	PluginContext,
	ResolveIdResult,
} from 'rollup'
import { fileURLToPath, pathToFileURL } from 'url'

import type { ConfigFile } from '../runtime/lib'
import { CachePolicy } from '../runtime/lib'
import { computeID, defaultConfigValues, keyFieldsForType } from '../runtime/lib/config'
import type { TransformPage } from '../vite/houdini'
import { houdini_mode } from './constants'
import { HoudiniError } from './error'
import * as fs from './fs'
import { pullSchema } from './introspection'
import * as path from './path'
import type { CollectedGraphQLDocument } from './types'

// @ts-ignore
const currentDir = global.__dirname || path.dirname(fileURLToPath(import.meta.url))

export type PluginMeta = PluginHooks & {
	name: string
	include_runtime: boolean
	version: string
	directory: string
}

// a place to hold conventions and magic strings
export class Config {
	filepath: string
	rootDir: string
	projectRoot: string
	schema: graphql.GraphQLSchema
	schemaPath?: string
	persistedQueryPath?: string
	exclude: string[]
	scalars?: ConfigFile['scalars']
	module: 'commonjs' | 'esm' = 'esm'
	cacheBufferSize?: number
	defaultCachePolicy: CachePolicy
	defaultPartial: boolean
	internalListPosition: 'first' | 'last'
	defaultListTarget: 'all' | null = null
	definitionsFolder?: string
	newSchema: string = ''
	newDocuments: string = ''
	defaultKeys: string[] = ['id']
	typeConfig: ConfigFile['types']
	configFile: ConfigFile
	logLevel: LogLevel
	defaultFragmentMasking: 'enable' | 'disable' = 'enable'
	configIsRoute: ((filepath: string) => boolean) | null = null
	routesDir: string
	schemaPollInterval: number | null
	schemaPollHeaders:
		| ((env: any) => Record<string, string>)
		| Record<string, string | ((env: any) => string)>
	pluginMode: boolean = false
	plugins: PluginMeta[] = []

	constructor({
		filepath,
		loadFrameworkConfig,
		...configFile
	}: ConfigFile & { filepath: string; loadFrameworkConfig?: boolean }) {
		this.configFile = defaultConfigValues(configFile)

		// depreciate disableMasking in favor of defaultFragmentMasking
		// @ts-ignore
		if (configFile.disableMasking !== undefined) {
			throw new HoudiniError({
				message: `"disableMasking" was replaced by "defaultFragmentMasking". Please update your config file.`,
			})
		}

		// apply defaults and pull out the values
		let {
			schema,
			schemaPath = './schema.graphql',
			exclude = [],
			module = 'esm',
			scalars,
			cacheBufferSize,
			definitionsPath,
			defaultCachePolicy = CachePolicy.CacheOrNetwork,
			defaultPartial = false,
			defaultListPosition = 'append',
			defaultListTarget = null,
			defaultKeys,
			types = {},
			logLevel,
			defaultFragmentMasking = 'enable',
			watchSchema,
			projectDir,
		} = this.configFile

		// if we're given a schema string
		if (typeof schema === 'string') {
			this.schema = graphql.buildSchema(schema)
		} else {
			this.schema = schema!
		}

		// validate the log level value
		if (logLevel && !Object.values(LogLevel).includes(logLevel.toLowerCase() as LogLevel)) {
			console.warn(
				`⚠️ Invalid log level provided. Valid values are: ${JSON.stringify(
					Object.values(LogLevel)
				)}`
			)
			logLevel = LogLevel.Summary
		}

		// save the values we were given
		this.schemaPath = schemaPath
		this.filepath = filepath
		this.exclude = Array.isArray(exclude) ? exclude : [exclude]
		this.module = module
		this.projectRoot = path.dirname(
			projectDir ? path.join(process.cwd(), projectDir) : filepath
		)
		this.scalars = scalars
		this.cacheBufferSize = cacheBufferSize
		this.defaultCachePolicy = defaultCachePolicy
		this.defaultPartial = defaultPartial
		this.internalListPosition = defaultListPosition === 'append' ? 'last' : 'first'
		this.defaultListTarget = defaultListTarget
		this.definitionsFolder = definitionsPath
		this.logLevel = ((logLevel as LogLevel) || LogLevel.Summary).toLowerCase() as LogLevel
		this.defaultFragmentMasking = defaultFragmentMasking
		this.routesDir = path.join(this.projectRoot, 'src', 'routes')
		this.schemaPollInterval = watchSchema?.interval ?? 2000
		this.schemaPollHeaders = watchSchema?.headers ?? {}
		this.rootDir = path.join(this.projectRoot, '$houdini')

		// hold onto the key config
		if (defaultKeys) {
			this.defaultKeys = defaultKeys
		}
		if (types) {
			this.typeConfig = {
				...this.typeConfig,
				...types,
			}
		}
	}

	async apiURL() {
		const apiURL = this.configFile.watchSchema?.url
		if (!apiURL) {
			return ''
		}

		const env = await this.getEnv()
		return this.processEnvValues(env, apiURL)
	}

	get include() {
		// if the config file has one, use it
		if (this.configFile.include) {
			return Array.isArray(this.configFile.include)
				? this.configFile.include
				: [this.configFile.include]
		}

		// we have to figure out a reasonable default so start with the normal extensions
		const extensions = ['.graphql', '.gql', '.ts', '.js'].concat(
			this.plugins.flatMap((plugin) => plugin.extensions ?? [])
		)

		// any file of a valid extension in src is good enough
		return [`src/**/*{${extensions.join(',')}}`]
	}

	pluginConfig<ConfigType extends {}>(name: string): ConfigType {
		// @ts-ignore
		return this.configFile.plugins?.[name] ?? {}
	}

	async getEnv() {
		// let plugins pick up environment variables from custom places
		let env: Record<string, string | undefined> = process.env
		for (const plugin of this.plugins) {
			if (plugin.env) {
				env = {
					...(await plugin.env({ config: this, env })),
				}
			}
		}

		return env
	}

	processEnvValues(
		env: Record<string, string | undefined>,
		value: string | ((env: any) => string)
	) {
		let headerValue
		if (typeof value === 'function') {
			headerValue = value(env)
		} else if (value.startsWith('env:')) {
			headerValue = env[value.slice('env:'.length)]
		} else {
			headerValue = value
		}

		return headerValue
	}

	async pullHeaders() {
		const env = await this.getEnv()

		// if the whole thing is a function, just call it
		if (typeof this.schemaPollHeaders === 'function') {
			return this.schemaPollHeaders(env)
		}

		// we need to turn the map into the correct key/value pairs
		const headers = Object.fromEntries(
			Object.entries(this.schemaPollHeaders || {})
				.map(([key, value]) => {
					const headerValue = this.processEnvValues(env, value)

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

	async sourceFiles() {
		return [
			...new Set(
				(
					await Promise.all(
						this.include.map((filepath) =>
							fs.glob(path.join(this.projectRoot, filepath))
						)
					)
				)
					.flat()
					.filter((filepath) => this.includeFile(filepath))
					// don't include the schema path as a source file
					.filter((filepath) => {
						const prefix = this.schemaPath?.startsWith('./') ? './' : ''

						return (
							!this.schemaPath ||
							!minimatch(
								prefix +
									path.relative(this.projectRoot, filepath).replaceAll('\\', '/'),
								this.schemaPath
							)
						)
					})
			),
		]
	}

	/*

		Directory structure

	*/

	// the directory where we put all of the artifacts
	get artifactDirectory() {
		return path.join(this.rootDir, this.artifactDirectoryName)
	}

	get artifactDirectoryName() {
		return 'artifacts'
	}

	// the directory where artifact types live
	get artifactTypeDirectory() {
		return this.artifactDirectory
	}

	// where we will place the runtime
	get runtimeDirectory() {
		return path.join(this.rootDir, 'runtime')
	}

	// Default to => $houdini/graphql
	get definitionsDirectory() {
		return this.definitionsFolder
			? path.join(this.projectRoot, this.definitionsFolder)
			: path.join(this.rootDir, 'graphql')
	}

	get enumRuntimeDefinitionsPath() {
		return path.join(this.definitionsDirectory, 'enums.js')
	}

	get enumTypesDefinitionsPath() {
		return path.join(this.definitionsDirectory, 'enums.d.ts')
	}

	get definitionsSchemaPath() {
		return path.join(this.definitionsDirectory, 'schema.graphql')
	}

	get definitionsDocumentsPath() {
		return path.join(this.definitionsDirectory, 'documents.gql')
	}

	get typeIndexPath() {
		return path.join(this.rootDir, 'index.d.ts')
	}

	get typeRootDir() {
		return path.join(this.rootDir, 'types')
	}

	get typeRootFile() {
		return '$houdini.d.ts'
	}

	findModule(
		pkg: string = 'houdini',
		currentLocation: string = path.join(path.dirname(this.filepath))
	) {
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

	get runtimeSource() {
		// when running in the real world, scripts are nested in a sub directory of build, in tests they aren't nested
		// under /src so we need to figure out how far up to go to find the appropriately compiled runtime
		const relative = houdini_mode.is_testing
			? path.join(currentDir, '..', '..')
			: // start here and go to parent until we find the node_modules/houdini folder
			  this.findModule()

		const which = this.module === 'esm' ? 'esm' : 'cjs'

		// we want to copy the typescript source code for the templates and then compile the files according
		// to the requirements of the platform
		return path.resolve(relative, 'build', `runtime-${which}`)
	}

	artifactTypePath(document: graphql.DocumentNode) {
		return path.join(this.artifactTypeDirectory, `${this.documentName(document)}.d.ts`)
	}

	// the location of the artifact generated corresponding to the provided documents
	artifactPath(document: graphql.DocumentNode): string {
		// use the operation name for the artifact
		return path.join(this.artifactDirectory, this.documentName(document) + '.js')
	}

	// the path that the runtime can use to import an artifact
	artifactImportPath(name: string): string {
		return `$houdini/${this.artifactDirectoryName}/${name}`
	}

	keyFieldsForType(type: string) {
		return keyFieldsForType(this.configFile, type)
	}

	computeID(type: string, data: any): string {
		return computeID(this.configFile, type, data)
	}

	// a string identifier for the document (must be unique)
	documentName(document: graphql.DocumentNode): string {
		// if there is an operation in the document
		const operation = document.definitions.find(
			({ kind }) => kind === graphql.Kind.OPERATION_DEFINITION
		) as graphql.OperationDefinitionNode
		if (operation) {
			// if the operation does not have a name
			if (!operation.name) {
				// we can't give them a file
				throw new Error('encountered operation with no name: ' + graphql.print(document))
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
			return fragmentDefinitions.map((fragment) => fragment.name.value).join('_')
		}

		// we don't know how to generate a name for this document
		throw new Error('Could not generate artifact name for document: ' + graphql.print(document))
	}

	isSelectionScalar(type: string) {
		return ['String', 'Boolean', 'Float', 'ID', 'Int']
			.concat(Object.keys(this.scalars || {}))
			.includes(type)
	}

	createDirectories() {
		fs.mkdirpSync(this.artifactDirectory)
		fs.mkdirpSync(this.artifactTypeDirectory)
		fs.mkdirpSync(this.runtimeDirectory)
		fs.mkdirpSync(this.definitionsDirectory)
	}

	get compiledAssetsDir() {
		return path.join(this.rootDir, '.build')
	}

	compiledAssetPath(filepath: string) {
		return path.join(
			this.compiledAssetsDir,
			path.relative(process.cwd(), filepath).replaceAll(path.sep, '_').replace('.ts', '.js')
		)
	}

	includeFile(
		filepath: string,
		{
			root = this.projectRoot,
			ignore_plugins = false,
		}: { root?: string; ignore_plugins?: boolean } = {}
	) {
		let included = false
		// plugins might define custom include logic
		for (const plugin of ignore_plugins ? [] : this.plugins) {
			if (!plugin.include) {
				continue
			}

			if (plugin.include(this, filepath)) {
				included = true
				break
			}
		}

		// if the filepath doesn't match the include we're done
		if (
			!included &&
			!this.include.some((pattern) => minimatch(filepath, path.join(root, pattern)))
		) {
			return false
		}

		// if there is an exclude, make sure the path doesn't match any of the exclude patterns
		return (
			!this.exclude ||
			this.exclude.length === 0 ||
			!this.exclude.some((pattern) => minimatch(filepath, pattern))
		)
	}

	pluginRuntimeDirectory(name: string) {
		return path.join(this.pluginDirectory(name), 'runtime')
	}

	get pluginRootDirectory() {
		return houdini_mode.is_testing ? '../../../' : path.join(this.rootDir, 'plugins')
	}

	pluginDirectory(name: string) {
		return path.join(this.pluginRootDirectory, name)
	}

	/*

		GraphqQL conventions

	*/
	get loadDirective() {
		return 'load'
	}

	get maskEnableDirective() {
		return 'mask_enable'
	}

	get maskDisableDirective() {
		return 'mask_disable'
	}

	get listDirective() {
		return 'list'
	}

	get listPrependDirective() {
		return 'prepend'
	}

	get listAppendDirective() {
		return 'append'
	}

	get listParentDirective() {
		return 'parentID'
	}

	/**
	 * @deprecated
	 */
	get deprecatedlistDirectiveParentIDArg() {
		return 'parentID'
	}

	get listAllListsDirective() {
		return 'allLists'
	}

	get listNameArg() {
		return 'name'
	}

	get insertFragmentSuffix() {
		return `_insert`
	}

	get removeFragmentSuffix() {
		return `_remove`
	}

	get toggleFragmentSuffix() {
		return `_toggle`
	}

	get deleteDirectiveSuffix() {
		return `_delete`
	}

	get whenDirective() {
		return 'when'
	}

	get whenNotDirective() {
		return this.whenDirective + '_not'
	}

	get liveDirective() {
		return 'live'
	}

	get argumentsDirective() {
		return 'arguments'
	}

	get withDirective() {
		return 'with'
	}

	get paginateDirective() {
		return 'paginate'
	}

	get paginateNameArg() {
		return 'name'
	}

	get cacheDirective() {
		return 'cache'
	}

	get cachePartialArg() {
		return 'partial'
	}

	get cachePolicyArg() {
		return 'policy'
	}

	paginationQueryName(documentName: string) {
		return documentName + '_Pagination_Query'
	}

	isDeleteDirective(name: string) {
		return name.endsWith(this.deleteDirectiveSuffix)
	}

	listDeleteDirective(name: string): string {
		return name + this.deleteDirectiveSuffix
	}

	deleteDirectiveType(name: string) {
		return name.slice(0, name.length - this.deleteDirectiveSuffix.length)
	}

	isInsertFragment(name: string) {
		return name.endsWith(this.insertFragmentSuffix)
	}

	listInsertFragment(name: string): string {
		return name + this.insertFragmentSuffix
	}

	listToggleFragment(name: string): string {
		return name + this.toggleFragmentSuffix
	}

	isRemoveFragment(name: string) {
		return name.endsWith(this.removeFragmentSuffix)
	}

	isToggleFragment(name: string) {
		return name.endsWith(this.toggleFragmentSuffix)
	}

	listRemoveFragment(name: string): string {
		return name + this.removeFragmentSuffix
	}

	isInternalEnum(node: graphql.EnumTypeDefinitionNode): boolean {
		// if we are looking at an enum, it could be CachePolicy
		return node.name.value === 'CachePolicy'
	}

	isInternalDirective({ name }: graphql.DirectiveNode): boolean {
		return (
			[
				this.listDirective,
				this.listPrependDirective,
				this.listAppendDirective,
				this.listParentDirective,
				this.listAllListsDirective,
				this.whenDirective,
				this.whenNotDirective,
				this.argumentsDirective,
				this.withDirective,
				this.paginateDirective,
				this.cacheDirective,
				this.loadDirective,
				this.maskEnableDirective,
				this.maskDisableDirective,
			].includes(name.value) || this.isDeleteDirective(name.value)
		)
	}

	isListFragment(name: string): boolean {
		return (
			name.endsWith(this.insertFragmentSuffix) ||
			name.endsWith(this.removeFragmentSuffix) ||
			name.endsWith(this.toggleFragmentSuffix)
		)
	}

	isListOperationDirective(name: string): boolean {
		return name.endsWith(this.deleteDirectiveSuffix)
	}

	isFragmentForList(listName: string, fragmentName: string) {
		return fragmentName.startsWith(listName)
	}

	// return 'insert' for All_Users_insert
	listOperationFromFragment(fragmentName: string): 'insert' | 'remove' | 'toggle' {
		// check the name against the fragment patterns
		if (this.isInsertFragment(fragmentName)) {
			return 'insert'
		} else if (this.isRemoveFragment(fragmentName)) {
			return 'remove'
		} else if (this.isToggleFragment(fragmentName)) {
			return 'toggle'
		}

		throw new Error('Could not determine list operation from fragment name: ' + fragmentName)
	}

	listNameFromDirective(directiveName: string): string {
		try {
			return this.listNameFromFragment(directiveName)
		} catch (e) {
			throw new Error('Could not find list name from directive: ' + directiveName)
		}
	}

	listNameFromFragment(fragmentName: string): string {
		// starting at the end of the fragment name going left, look for a _
		for (let i = fragmentName.length - 1; i >= 0; i--) {
			// if we hit a _
			if (fragmentName[i] === '_') {
				return fragmentName.slice(0, i)
			}
		}

		throw new Error('Could not find list name from fragment: ' + fragmentName)
	}

	extractDefinition(document: graphql.DocumentNode): graphql.ExecutableDefinitionNode {
		// make sure there's only one definition
		if (document.definitions.length !== 1) {
			throw new Error('Encountered document with multiple definitions')
		}

		// get the definition
		const definition = document.definitions[0]

		// make sure that it's an operation definition or a fragment definition
		if (definition.kind !== 'OperationDefinition' && definition.kind !== 'FragmentDefinition') {
			throw new Error('Encountered document without a fragment or operation definition')
		}

		return definition
	}

	extractQueryDefinition(document: graphql.DocumentNode): graphql.OperationDefinitionNode {
		const definition = this.extractDefinition(document)
		if (definition.kind !== 'OperationDefinition' || definition.operation !== 'query') {
			throw new Error('Encountered document with non query definition')
		}

		return definition
	}

	variableFunctionName(name: string) {
		return name + 'Variables'
	}
}

const DEFAULT_CONFIG_PATH = path.join(process.cwd(), 'houdini.config.js')

// helper function to load the config file
export async function readConfigFile(
	configPath: string = DEFAULT_CONFIG_PATH
): Promise<ConfigFile> {
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

// a place to store the current configuration
let _config: Config

async function loadSchemaFile(schemaPath: string): Promise<graphql.GraphQLSchema> {
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
				sourceFiles.map(async (filepath) => (await fs.readFile(filepath))!)
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
	if (schemaPath.endsWith('gql') || schemaPath.endsWith('graphql')) {
		return graphql.buildSchema(contents)
	}

	// the schema must point to a json blob (with data level or content of data directly)
	const jsonContents = JSON.parse(contents)
	if (jsonContents.data) {
		return graphql.buildClientSchema(jsonContents.data)
	}
	return graphql.buildClientSchema(jsonContents)
}

// if multiple calls to getConfig happen simultaneously, we want to only load the
// schema once (if it needs to happen, ie the file doesn't exist).
let pendingConfigPromise: Promise<Config> | null = null

// get the project's current configuration
export async function getConfig({
	configPath = DEFAULT_CONFIG_PATH,
	noSchema,
	...extraConfig
}: PluginConfig & { noSchema?: boolean } = {}): Promise<Config> {
	if (_config) {
		return _config
	}

	// if we have a pending promise, return the result of that
	if (pendingConfigPromise) {
		return await pendingConfigPromise
	}

	// there isn't a pending config so let's make one to claim
	let resolve: (cfg: Config | PromiseLike<Config>) => void = () => {}
	let reject = (message?: any) => {}
	pendingConfigPromise = new Promise((res, rej) => {
		resolve = res
		reject = rej
	})

	// look up the current config file
	let configFile = {
		...(await readConfigFile(configPath)),
	}

	// we need to process the plugins before we instantiate the config object

	// build up the list of plugins
	const plugins = []

	// load the specified plugins
	for (const [pluginName, plugin_config] of Object.entries(configFile.plugins ?? {})) {
		try {
			// look for the houdini-svelte module
			const pluginDirectory = _config.findModule(pluginName)
			const { default: pluginFactory }: { default: Plugin } = await import(
				pathToFileURL(pluginDirectory).toString() + '/build/plugin-esm/index.js'
			)
			let include_runtime = false
			try {
				await fs.stat(path.join(pluginDirectory, 'build', 'runtime-esm'))
				include_runtime = true
			} catch {}

			// figure out the current version
			let version = ''
			try {
				const packageJsonSrc = await fs.readFile(path.join(pluginDirectory, 'package.json'))
				if (!packageJsonSrc) {
					throw new Error('skip')
				}
				const packageJSON = JSON.parse(packageJsonSrc)
				version = packageJSON.version
			} catch {}

			// if the plugin config is a function, we should pass the config files
			// eslint-disable-next-line no-constant-condition
			if (typeof plugin_config)
				// add the plugin to the list
				plugins.push({
					...(await pluginFactory(plugin_config)),
					name: pluginName,
					include_runtime,
					version,
					directory: pluginDirectory,
				})
		} catch (e) {
			throw new Error(
				`Could not find plugin: ${pluginName}. Are you sure its installed? If so, please open a ticket on GitHub.`
			)
		}
	}

	try {
		_config = new Config({
			...configFile,
			...extraConfig,
			filepath: configPath,
		})

		const apiURL = await _config.apiURL()

		// look up the schema if we need to
		if (_config.schemaPath && !_config.schema) {
			let schemaOk = true
			// we might have to pull the schema first
			if (apiURL) {
				// make sure we don't have a pattern pointing to multiple files and a remove URL
				if (fs.glob.hasMagic(_config.schemaPath)) {
					console.log(
						`⚠️  Your houdini configuration contains an apiUrl and a path pointing to multiple files.
This will prevent your schema from being pulled.`
					)
				}
				// we might have to create the file
				else if (!(await fs.readFile(_config.schemaPath))) {
					console.log('⌛ Pulling schema from api')
					schemaOk = await pullSchema(apiURL, _config.schemaPath)
				}
			}

			// the schema is safe to load
			if (schemaOk && !noSchema) {
				_config.schema = await loadSchemaFile(_config.schemaPath)
			}
		}
	} catch (e) {
		reject(e)
		throw e
	}

	// order the list of plugins
	_config.plugins = orderedPlugins(plugins)

	// look for any plugins with a loaded hook
	await Promise.all(_config.plugins.map((plugin) => plugin.after_load?.(_config)))

	// we're done and have a valid config
	resolve(_config)
	return _config
}

export enum LogLevel {
	Full = 'full',
	Summary = 'summary',
	ShortSummary = 'short-summary',
	Quiet = 'quiet',
}

export type Plugin = (args?: PluginConfig) => Promise<PluginHooks>

export const orderedPlugins = (plugins: PluginMeta[]) => {
	const ordered = plugins.filter(
		(plugin) => plugin.order === 'before' || plugin.order === undefined
	)
	ordered.push(
		...plugins.filter((plugin) => plugin.order === 'core'),
		...plugins.filter((plugin) => plugin.order === 'after')
	)
	return ordered
}

export type PluginHooks = {
	order?: 'before' | 'after' | 'core' // when not set, it will be "before"
	extensions?: string[]
	transform_runtime?: Record<string, (args: { config: Config; content: string }) => string>
	config?: (old: ConfigFile) => void | ConfigFile | Promise<ConfigFile | void>
	after_load?: (config: Config) => Promise<void> | void
	artifact_data?: (config: Config, doc: CollectedGraphQLDocument) => Record<string, any>
	extract_documents?: (
		config: Config,
		filepath: string,
		content: string
	) => Promise<string[]> | string[]
	generate?: GenerateHook
	client_plugins?:
		| Record<string, null | Record<string, any>>
		| ((config: ConfigFile, pluginConfig: any) => Record<string, null | Record<string, any>>)
	transform_file?: (page: TransformPage) => Promise<{ code: string }> | { code: string }
	index_file?: ModuleIndexTransform
	graphql_tag_return?: (args: {
		config: Config
		doc: CollectedGraphQLDocument
		ensure_import: (import_args: { identifier: string; module: string }) => void
	}) => string | undefined
	env?: (args: { env: any; config: Config }) => Promise<Record<string, string>>
	validate?: (args: {
		config: Config
		documents: CollectedGraphQLDocument[]
	}) => Promise<void> | void
	vite?: {
		// these type definitions are copy and pasted from the vite ones
		// with config added to the appropriate options object
		resolveId?: ObjectHook<
			(
				this: PluginContext,
				source: string,
				importer: string | undefined,
				options: {
					config: Config
					custom?: CustomPluginOptions
					ssr?: boolean
					/* Excluded from this release type: scan */
					isEntry: boolean
				}
			) => Promise<ResolveIdResult> | ResolveIdResult
		>
		load?: ObjectHook<
			(
				this: PluginContext,
				id: string,
				options: {
					config: Config
					ssr?: boolean
				}
			) => Promise<LoadResult> | LoadResult
		>
	}
	include?: (config: Config, filepath: string) => boolean | null | undefined
}

type ModuleIndexTransform = (arg: {
	config: Config
	content: string
	export_default_as(args: { module: string; as: string }): string
	export_star_from(args: { module: string }): string
	plugin_root: string
	typedef: boolean
	documents: CollectedGraphQLDocument[]
}) => string

export type GenerateHook = (args: GenerateHookInput) => Promise<void> | void

export type GenerateHookInput = {
	config: Config
	documents: CollectedGraphQLDocument[]
	plugin_root: string
}

export type PluginConfig = { configPath?: string } & Partial<ConfigFile>
