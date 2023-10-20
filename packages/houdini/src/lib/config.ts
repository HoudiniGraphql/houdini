import { mergeSchemas } from '@graphql-tools/schema'
import * as graphql from 'graphql'
import minimatch from 'minimatch'
import { fileURLToPath, pathToFileURL } from 'node:url'

import type { CachePolicies, ConfigFile, PaginateModes } from '../runtime/lib'
import { CachePolicy, PaginateMode } from '../runtime/lib'
import {
	computeID,
	defaultConfigValues,
	keyFieldsForType,
	localApiEndpoint,
} from '../runtime/lib/config'
import { houdini_mode } from './constants'
import { HoudiniError } from './error'
import * as fs from './fs'
import { pullSchema } from './introspection'
import * as path from './path'
import { plugin } from './plugin'
import type { LogLevels, PluginConfig, PluginHooks, PluginInit, ValueMap } from './types'
import { LogLevel } from './types'

// @ts-ignore
const currentDir = path.dirname(fileURLToPath(import.meta.url))

export type PluginMeta = PluginHooks & {
	name: string
	filepath: string
}

// a place to hold conventions and magic strings
export class Config {
	filepath: string
	rootDir: string
	localSchema: boolean
	projectRoot: string
	schema: graphql.GraphQLSchema
	schemaPath?: string
	persistedQueriesPath: string = './$houdini/persisted_queries.json'
	exclude: string[]
	scalars?: ConfigFile['scalars']
	module: 'commonjs' | 'esm' = 'esm'
	cacheBufferSize?: number
	defaultCachePolicy: CachePolicies
	defaultPartial: boolean
	internalListPosition: 'first' | 'last'
	defaultListTarget: 'all' | null = null
	defaultPaginateMode: PaginateModes
	definitionsFolder?: string
	newDocuments: string = ''
	defaultKeys: string[] = ['id']
	typeConfig: ConfigFile['types']
	configFile: ConfigFile
	logLevel: LogLevels
	defaultFragmentMasking: 'enable' | 'disable' = 'enable'
	configIsRoute: ((filepath: string) => boolean) | null = null
	routesDir: string
	schemaPollInterval: number | null
	schemaPollHeaders:
		| ((env: any) => Record<string, string>)
		| Record<string, string | ((env: any) => string)>
	pluginMode: boolean = false
	plugins: PluginMeta[] = []

	// while processing documents, we might run into componenetFields on fragment
	// definitions.
	componentFields: Record<
		string,
		Record<
			string,
			{
				fragment: string
				directive: graphql.DirectiveNode
				filepath: string
				prop: string
				parent: graphql.FragmentDefinitionNode | graphql.FragmentSpreadNode
			}
		>
	> = {}

	constructor({
		filepath,
		loadFrameworkConfig,
		...configFile
	}: ConfigFile & { filepath: string; loadFrameworkConfig?: boolean }) {
		this.configFile = defaultConfigValues(configFile)
		this.localSchema = false
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
			defaultPaginateMode = PaginateMode.Infinite,
			defaultKeys,
			types = {},
			logLevel,
			defaultFragmentMasking = 'enable',
			watchSchema,
			projectDir,
			persistedQueriesPath,
		} = this.configFile

		// if we're given a schema string
		if (typeof schema === 'string') {
			this.schema = graphql.buildSchema(schema)
		} else {
			this.schema = schema!
		}

		// validate the log level value
		if (logLevel && !Object.values(LogLevel).includes(logLevel.toLowerCase() as LogLevels)) {
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
		this.defaultPaginateMode = defaultPaginateMode
		this.definitionsFolder = definitionsPath
		this.logLevel = ((logLevel as LogLevels) || LogLevel.Summary).toLowerCase() as LogLevels
		this.defaultFragmentMasking = defaultFragmentMasking
		this.routesDir = path.join(this.projectRoot, 'src', 'routes')
		this.schemaPollInterval = watchSchema?.interval === undefined ? 2000 : watchSchema.interval
		this.schemaPollHeaders = watchSchema?.headers ?? {}
		this.rootDir = path.join(this.projectRoot, '$houdini')
		this.#fragmentVariableMaps = {}

		if (persistedQueriesPath) {
			this.persistedQueriesPath = persistedQueriesPath
		}

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

	get componentScalar() {
		return 'Component'
	}

	#newSchemaInstance: graphql.GraphQLSchema | null = null
	schemaString: string = ''
	set newSchema(value: string) {
		this.schemaString = value
		if (value) {
			this.#newSchemaInstance = graphql.buildSchema(value)
		} else {
			this.#newSchemaInstance = null
		}
	}

	get newSchema() {
		return this.schemaString
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

	get sourceDir() {
		return path.join(this.projectRoot, 'src')
	}

	get localApiDir() {
		return path.join(this.sourceDir, 'api')
	}

	get localAPIUrl() {
		return localApiEndpoint(this.configFile)
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

	get routerBuildDirectory() {
		return path.join(this.projectRoot, 'dist')
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

	get runtimeSource() {
		// when running in the real world, scripts are nested in a sub directory of build, in tests they aren't nested
		// under /src so we need to figure out how far up to go to find the appropriately compiled runtime
		let relative: string
		if (houdini_mode.is_testing) {
			relative = path.join(currentDir, '..', '..')
		} else if (process.versions.pnp) {
			// we are in a PnP environment
			// retrieve the PnP API (Yarn injects the `findPnpApi` into `node:module` builtin module in runtime)
			const { findPnpApi } = require('node:module')

			// this will traverse the file system to find the closest `.pnp.cjs` file and return the PnP API based on it
			const pnp = findPnpApi(this.filepath)

			// this will return the houdini package location (it will be inside the .zip file)
			// it will throw if the module isn't found in the project's dependencies, but it should be there
			// this will be something like `.yarn/cache/houdini-npm-bcb9b12a88-c0f1080ca8.zip/node_modules/houdini/`
			// it is inside the .zip archive, but since Yarn dynamically patches `fs` module to add support for reading
			// files from the .zip archives, we can just use the path as-is
			// https://yarnpkg.com/features/pnp#packages-are-stored-inside-zip-archives-how-can-i-access-their-files
			relative = pnp.resolveToUnqualified('houdini', this.filepath)
		} else {
			// start here and go to parent until we find the node_modules/houdini folder
			relative = findModule('houdini', path.join(path.dirname(this.filepath)))
		}

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
		// the only type that doesn't have a well defined ID is the root query type
		return this.schema.getQueryType()?.name === type
			? []
			: keyFieldsForType(this.configFile, type)
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
			return fragmentDefinitions[0].name.value
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
		return path.join(this.rootDir, 'build')
	}

	compiledAssetPath(filepath: string) {
		return path.join(
			this.compiledAssetsDir,
			path.relative(process.cwd(), filepath).replaceAll(path.sep, '_').replace('.ts', '.js')
		)
	}

	excludeFile(filepath: string) {
		// if the configured exclude does not allow this file, we're done
		if (
			this.exclude.length > 0 &&
			this.exclude.some((pattern) => minimatch(filepath, pattern))
		) {
			return true
		}

		// look at every plugin
		for (const plugin of this.plugins) {
			if (plugin?.exclude?.({ config: this, filepath })) {
				return true
			}
		}

		// if we got this far, we shouldn't exclude
		return false
	}

	includeFile(
		filepath: string,
		{
			root = this.projectRoot,
			ignore_plugins = false,
		}: { root?: string; ignore_plugins?: boolean } = {}
	) {
		const parsed = path.parse(filepath)
		filepath = `${parsed.dir}/${parsed.name}${parsed.ext.split('?')[0]}`

		let included = false
		// plugins might define custom include logic
		for (const plugin of ignore_plugins ? [] : this.plugins) {
			if (!plugin.include) {
				continue
			}

			if (plugin.include({ config: this, filepath })) {
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
		return !this.excludeFile(filepath)
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

		GraphQL conventions

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

	get blockingDirective() {
		return 'blocking'
	}

	get blockingDisableDirective() {
		return 'blocking_disable'
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

	get listOrPaginateNameArg() {
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

	get loadingDirective() {
		return `loading`
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

	get paginateModeArg() {
		return 'mode'
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

	get requiredDirective() {
		return 'required'
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
		return node.name.value === 'CachePolicy' || node.name.value === 'PaginateMode'
	}

	isInternalDirective(name: string): boolean {
		// an internal directive is one that was defined in the new schema
		const internalDirectives =
			this.#newSchemaInstance?.getDirectives().reduce<string[]>((list, directive) => {
				return list.concat(directive.name)
			}, []) ?? []

		return (
			!defaultDirectives.includes(name) &&
			(internalDirectives.includes(name) || this.isDeleteDirective(name))
		)
	}

	get componentFieldDirective() {
		return 'componentField'
	}

	componentFieldFragmentName(args: {
		type: string
		entry: graphql.DirectiveNode | string
	}): string {
		let fieldValue = args.entry
		if (typeof fieldValue !== 'string') {
			// look at the directive for the field name
			const field = fieldValue.arguments?.find((arg) => arg.name.value === 'field')?.value
			fieldValue = field?.kind === 'StringValue' ? field.value : ''
		}
		if (!fieldValue) {
			return ''
		}

		return `__componentField__${args.type}_${fieldValue}`
	}

	// we need a function that walks down a graphql query and detects the use of a directive config.paginateDirective
	localDocumentData(document: graphql.DocumentNode): {
		paginated: boolean
		componentFields: { type: string; field: string }[]
	} {
		let paginated = false
		let componentFields: { type: string; field: string }[] = []

		// walk the document and look for features
		const typeInfo = new graphql.TypeInfo(this.schema)
		graphql.visit(
			document,
			graphql.visitWithTypeInfo(typeInfo, {
				Directive: (node) => {
					if ([this.paginateDirective].includes(node.name.value)) {
						paginated = true
					}
				},
				Field: (node) => {
					const parentType = typeInfo.getParentType()
					// if the field is a component field then we need to record it
					if (
						this.componentFields[parentType?.name ?? '']?.[node.name.value] &&
						parentType?.name
					) {
						// add the field to the list
						componentFields.push({ type: parentType?.name, field: node.name.value })
					}
				},
			})
		)

		// we're done
		return { paginated, componentFields }
	}

	#fragmentVariableMaps: Record<string, { args: ValueMap | null; fragment: string }>
	registerFragmentVariablesHash({
		hash,
		args,
		fragment,
	}: {
		hash: string
		args: ValueMap | null
		fragment: string
	}) {
		this.#fragmentVariableMaps[hash] = {
			args: this.serializeValueMap(args),
			fragment,
		}
	}
	getFragmentVariablesHash(hash: string) {
		return (
			this.#fragmentVariableMaps[hash] ?? {
				fragment: hash,
				args: {},
				hash,
			}
		)
	}

	serializeValueMap(map: ValueMap | null): ValueMap | null {
		if (!map) {
			return null
		}

		return Object.fromEntries(
			Object.entries(map).map(([key, input]) => {
				// the value we are setting depends on the value of the input
				const result = {
					kind: input.kind,
				}
				if (typeof input === 'object') {
					if ('value' in input) {
						// @ts-ignore
						result.value = input.value
					}
					if ('values' in input) {
						// @ts-ignore
						result.values = input.values.map(
							(value) => this.serializeValueMap({ foo: value })!.foo!
						)
					}
					if ('name' in input) {
						// @ts-ignore
						result.name = input.name
					}

					if ('fields' in input) {
						// @ts-ignore
						result.fields = input.fields.map((field) => ({
							name: field.name,
							value: this.serializeValueMap({ foo: field.value })!.foo!,
						}))
					}
				}

				return [key, result]
			})
		) as ValueMap
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

// a place to store the current configuration
let _config: Config

// if multiple calls to getConfig happen simultaneously, we want to only load the
// schema once (if it needs to happen, ie the file doesn't exist).
let pendingConfigPromise: Promise<Config> | null = null

// get the project's current configuration
export async function getConfig({
	configPath = DEFAULT_CONFIG_PATH,
	noSchema,
	forceReload,
	...extraConfig
}: PluginConfig & { noSchema?: boolean; forceReload?: boolean } = {}): Promise<Config> {
	// if we force a reload, we will bypass this part
	if (!forceReload) {
		if (_config) {
			return _config
		}

		// if we have a pending promise, return the result of that
		if (pendingConfigPromise) {
			return await pendingConfigPromise
		}
	}

	// there isn't a pending config so let's make one to claim
	let resolve: (cfg: Config | PromiseLike<Config>) => void = () => {}
	let reject = (message?: any) => {}
	pendingConfigPromise = new Promise((res, rej) => {
		resolve = res
		reject = rej
	})

	// wrap the rest of the function so that errors resolve the promise as well
	try {
		// look up the current config file
		let configFile = await readConfigFile(configPath)

		// we need to process the plugins before we instantiate the config object
		// so that we can compute the final configFile

		// the list of plugins comes from two places:
		// - the config file
		// - the value of the HOUDINI_CODEGEN_PLUGIN environment variable
		const pluginConfigs = Object.entries(configFile.plugins ?? {})

		// if the environment variable is defined, add it to the list
		if (process.env.HOUDINI_CODEGEN_PLUGIN) {
			pluginConfigs.push([process.env.HOUDINI_CODEGEN_PLUGIN, {}])
		}

		// build up the list of plugins
		const pluginsNested: (PluginMeta | PluginMeta[])[] = []
		for (const [pluginName, plugin_config] of pluginConfigs) {
			// we need to find the file containing the plugin
			// if the name is a relative path, we're done
			let pluginFile = path.join(path.dirname(configPath), pluginName)

			// the plugin name doesn't start with . then treat it as a global thing
			if (!pluginName.startsWith('.')) {
				// the plugin factory will either give us a
				pluginFile = await pluginPath(pluginName, configPath)
			}

			// if we got this far, pluginFile points to a file that supposedly exports a plugin
			const { default: pluginInit }: { default: PluginInit } = await import(
				pathToFileURL(pluginFile).toString()
			)
			if (!pluginInit.plugin || !pluginInit.name) {
				throw new HoudiniError({
					filepath: pluginFile,
					message: `The default export does not match the expected shape.`,
					description:
						'Please make sure that the file exports the default of the plugin function.',
				})
			}

			// grab the plugin config and add the plugin to the list
			const hooks = await pluginInit.plugin(plugin_config)
			// apply boolean filters and always have a list
			const hooksList = (Array.isArray(hooks) ? hooks : [hooks]).filter(Boolean).flat() as (
				| PluginHooks
				| PluginInit
			)[]

			// add the flat list of hooks to the pile
			pluginsNested.push(
				await flattenPluginList(configPath, hooksList, pluginName, pluginFile)
			)
		}

		// flatten any lists of hooks
		const plugins = pluginsNested.flat()

		// pass the config file through all of the plugins
		for (const plugin of plugins) {
			if (plugin.config) {
				try {
					const configFactory = (await import(plugin.config)).default
					if (configFactory) {
						configFile =
							typeof configFactory === 'function'
								? configFactory(configFile)
								: configFactory
					}
				} catch {
					console.log('could not load config file ' + plugin.config)
				}
			}
		}

		_config = new Config({
			...configFile,
			...extraConfig,
			filepath: configPath,
		})

		// if there is a local schema then we need to ignore the schema check
		let localSchema = false
		try {
			let apiDir = _config.localApiDir
			for (const child of await fs.readdir(apiDir)) {
				if (path.parse(child).name === '+schema') {
					localSchema = true
					break
				}
			}
		} catch {}
		_config.localSchema = localSchema

		const apiURL = await _config.apiURL()

		// look up the schema if we need to
		if (!_config.localSchema && _config.schemaPath && !_config.schema) {
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
					schemaOk = (await pullSchema(apiURL, _config.schemaPath)) !== null
				}
			}

			// the schema is safe to load
			if (schemaOk && !noSchema) {
				_config.schema = await loadSchemaFile(_config.schemaPath)
			}
		}

		// order the list of plugins
		_config.plugins = orderedPlugins(plugins)

		// look for any plugins with a loaded hook
		await Promise.all(_config.plugins.map((plugin) => plugin.afterLoad?.({ config: _config })))

		// we're done and have a valid config
		resolve(_config)
		return _config

		// error handling
	} catch (e) {
		reject(e)
		throw e
	}
}

async function flattenPluginList(
	root: string,
	list: (PluginHooks | PluginInit)[],
	name: string,
	pluginFile: string
): Promise<PluginMeta[]> {
	// a plugin value might contain other plugins that need to be
	// included. keep a running list of the plugins to process
	// so that we do this breadth-first
	const pluginsLeft: PluginInit[] = [
		{
			...plugin(name, async () => list),
			local: pluginFile,
		},
	]

	// the plugin data we collection
	const result: PluginMeta[] = []

	// while we have plugins left to process
	while (pluginsLeft.length > 0) {
		// all we are responsible for here is adding hooks to the list
		// processing one level of plugin values.
		// the next step down will happen on another tick of the while loop

		// pop the first element off of the list
		const head = pluginsLeft.shift()
		if (!head) {
			break
		}

		// look up the directory for the plugin
		const nestedFile = head.local ?? (await pluginPath(head.name, root))

		// invoke the plugin
		const nestedPlugin = await head.plugin(head.config ?? {})
		const nestedPluginValues = Array.isArray(nestedPlugin) ? nestedPlugin : [nestedPlugin]

		// look at all of the values exported by the plugins
		for (const value of nestedPluginValues) {
			if (!value) {
				continue
			}

			// if the plugin is a refence, add it to the list
			if ('__plugin_init__' in value) {
				pluginsLeft.push(value)
			} else {
				result.push({
					...value,
					name: head.name,
					filepath: nestedFile,
				})
			}
		}
	}

	// if we got this far, we processed all of the referenced plugins
	return result
}

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

async function pluginPath(plugin_name: string, config_path: string): Promise<string> {
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

const emptySchema = graphql.buildSchema('type Query { hello: String }')
const defaultDirectives = emptySchema.getDirectives().map((dir) => dir.name)
