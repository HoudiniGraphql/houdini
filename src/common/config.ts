import { mergeSchemas } from '@graphql-tools/schema'
import { glob } from 'glob'
import * as graphql from 'graphql'
import minimatch from 'minimatch'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { promisify } from 'util'

import { pullSchema } from '../cmd/utils'
import { computeID, ConfigFile, defaultConfigValues, keyFieldsForType } from '../runtime/lib'
import { CachePolicy, GraphQLTagResult } from '../runtime/lib/types'
import { HoudiniError } from './error'
import { extractLoadFunction } from './extractLoadFunction'
import * as fs from './fs'
import { parseSvelte } from './parse'
import { walkGraphQLTags } from './walk'

// @ts-ignore
const currentDir = global.__dirname || path.dirname(fileURLToPath(import.meta.url))

// a place to hold conventions and magic strings
export class Config {
	filepath: string
	rootDir: string
	projectRoot: string
	schema: graphql.GraphQLSchema
	apiUrl?: string
	schemaPath?: string
	persistedQueryPath?: string
	include: string
	exclude?: string
	scalars?: ConfigFile['scalars']
	framework: 'kit' | 'svelte' = 'kit'
	module: 'commonjs' | 'esm' = 'esm'
	cacheBufferSize?: number
	defaultCachePolicy: CachePolicy
	defaultPartial: boolean
	definitionsFolder?: string
	newSchema: string = ''
	newDocuments: string = ''
	defaultKeys: string[] = ['id']
	typeConfig: ConfigFile['types']
	configFile: ConfigFile
	logLevel: LogLevel
	disableMasking: boolean
	configIsRoute: ((filepath: string) => boolean) | null = null
	routesDir: string
	schemaPollInterval: number | null
	schemaPollHeaders: Record<string, string | ((env: any) => string)>
	pageQueryFilename: string
	plugin: boolean = false
	client: string
	globalStorePrefix: string
	quietQueryErrors: boolean

	constructor({
		filepath,
		loadFrameworkConfig,
		...configFile
	}: ConfigFile & { filepath: string; loadFrameworkConfig?: boolean }) {
		this.configFile = defaultConfigValues(configFile)

		// apply defaults and pull out the values
		let {
			schema,
			schemaPath = './schema.graphql',
			sourceGlob,
			include = `src/**/*.{svelte,graphql,gql,ts,js}`,
			exclude,
			apiUrl,
			framework = 'kit',
			module = 'esm',
			scalars,
			cacheBufferSize,
			definitionsPath,
			defaultCachePolicy = CachePolicy.CacheOrNetwork,
			defaultPartial = false,
			defaultKeys,
			types = {},
			logLevel,
			disableMasking = false,
			schemaPollInterval = 2000,
			schemaPollHeaders = {},
			pageQueryFilename = '+page.gql',
			projectDir,
			client,
			globalStorePrefix = 'GQL_',
			quietQueryErrors,
		} = this.configFile

		if (!client) {
			throw new HoudiniError({
				filepath,
				message: 'Invalid config file: missing client value.',
				description:
					'Please set it to the relative path (from houdini.config.js) to your client file. The file must have a default export with an instance of HoudiniClient.',
			})
		}

		// if we're given a schema string
		if (typeof schema === 'string') {
			this.schema = graphql.buildSchema(schema)
		} else {
			this.schema = schema!
		}

		if (sourceGlob) {
			const hasDefault = sourceGlob === 'src/**/*.{svelte,gql,graphql}'

			console.warn(`⚠️ config value \`sourceGlob\` has been renamed to \`include\`.
Please update your config file. Keep in mind, the new config parameter is optional and has a default of "src/**/*.{svelte,graphql,gql,ts,js}".
${
	hasDefault
		? 'You might prefer to remove the config value all together since you are using the old default value.'
		: 'Consider removing this config value and using `exclude` to filter out the files that match this default pattern that you want to avoid.'
}
`)
			include = sourceGlob
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
		this.apiUrl = apiUrl
		this.filepath = filepath
		this.include = include
		this.exclude = exclude
		this.framework = framework
		this.module = module
		this.projectRoot = path.dirname(
			projectDir ? path.join(process.cwd(), projectDir) : filepath
		)
		this.scalars = scalars
		this.cacheBufferSize = cacheBufferSize
		this.defaultCachePolicy = defaultCachePolicy
		this.defaultPartial = defaultPartial
		this.definitionsFolder = definitionsPath
		this.logLevel = ((logLevel as LogLevel) || LogLevel.Summary).toLowerCase() as LogLevel
		this.disableMasking = disableMasking
		this.routesDir = path.join(this.projectRoot, 'src', 'routes')
		this.schemaPollInterval = schemaPollInterval
		this.schemaPollHeaders = schemaPollHeaders
		this.rootDir = path.join(this.projectRoot, '$houdini')
		this.pageQueryFilename = pageQueryFilename
		this.client = client
		this.globalStorePrefix = globalStorePrefix
		this.quietQueryErrors = quietQueryErrors || false

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

		// Check that storeName & globalStoreName are not overlapping.
		// Not possible today, but maybe in the future if storeName starts to be configurable.
		if (this.storeName({ name: 'QueryName' }) === this.globalStoreName({ name: 'QueryName' })) {
			throw new HoudiniError({
				filepath,
				message: 'Invalid config file: "globalStoreName" and "storeName" are overlapping',
				description: `Here, both gives: ${this.storeName({ name: 'QueryName' })}`,
			})
		}
	}

	// compute if a path points to a component query or not
	isRoute(filepath: string): boolean {
		// a vanilla svelte app is never considered in a route
		if (this.framework === 'svelte') {
			return false
		}

		// only consider filepaths in src/routes
		if (!posixify(filepath).startsWith(posixify(this.routesDir))) {
			return false
		}

		// only consider layouts and pages as routes
		return ['+layout.svelte', '+page.svelte'].includes(path.parse(filepath).base)
	}

	get pullHeaders() {
		return Object.fromEntries(
			Object.entries(this.schemaPollHeaders || {}).map(([key, value]) => {
				let headerValue
				if (typeof value === 'function') {
					headerValue = value(process.env)
				} else if (value.startsWith('env:')) {
					headerValue = process.env[value.slice('env:'.length)]
				} else {
					headerValue = value
				}

				// if there was no value, dont add anything
				if (!headerValue) {
					return []
				}

				return [key, headerValue]
			})
		)
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

	// the directory where we put all of the stores
	get storesDirectory() {
		return path.join(this.rootDir, this.storesDirectoryName)
	}

	get metaFilePath() {
		return path.join(this.rootDir, 'meta.json')
	}

	get storesDirectoryName() {
		return 'stores'
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

	get typeRouteDir() {
		return path.join(this.typeRootDir, 'src', 'routes')
	}

	get typeRootFile() {
		return '$houdini.d.ts'
	}

	get runtimeSource() {
		// when running in the real world, scripts are nested in a sub directory of build, in tests they aren't nested
		// under /src so we need to figure out how far up to go to find the appropriately compiled runtime
		const relative = process.env.TEST
			? path.join(currentDir, '../../')
			: // TODO: it's very possible this breaks someones setup. the old version walked up from currentDir
			  // there isn't a consistent number of steps up anymore since the vite plugin and cmd live at different depths
			  // a better approach could be to start at current dir and walk up until we find a `houdini` dir
			  path.join(path.dirname(this.filepath), 'node_modules', 'houdini')

		// we want to copy the typescript source code for the templates and then compile the files according
		// to the requirements of the platform
		return path.resolve(
			relative,
			'build',
			this.module === 'esm' ? 'runtime-esm' : 'runtime-cjs'
		)
	}

	artifactTypePath(document: graphql.DocumentNode) {
		return path.join(this.artifactTypeDirectory, `${this.documentName(document)}.d.ts`)
	}

	// the location of the artifact generated corresponding to the provided documents
	artifactPath(document: graphql.DocumentNode): string {
		// use the operation name for the artifact
		// make sure to mark artifacts as .js in sveltekit
		return path.join(this.artifactDirectory, this.documentName(document) + '.js')
	}

	// the path that the runtime can use to import an artifact
	artifactImportPath(name: string): string {
		return `$houdini/${this.artifactDirectoryName}/${name}`
	}

	// the path that the runtime can use to import a store
	storeImportPath(name: string): string {
		return `$houdini/${this.storesDirectoryName}/${name}`
	}

	get storeSuffix() {
		// if this changes, we might have more forbiddenNames to add in the validator
		return 'Store'
	}

	storeName({ name }: { name: string }) {
		return name + this.storeSuffix
	}

	globalStoreName({ name }: { name: string }) {
		return this.globalStorePrefix + name
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

	async createDirectories(): Promise<void> {
		await Promise.all([
			fs.mkdirp(this.artifactDirectory),
			fs.mkdirp(this.artifactTypeDirectory),
			fs.mkdirp(this.runtimeDirectory),
			fs.mkdirp(this.storesDirectory),
			fs.mkdirp(this.definitionsDirectory),
			fs.mkdirp(this.typeRouteDir),
		])
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

	includeFile(filepath: string) {
		// deal with any relative imports from compiled assets
		filepath = this.resolveRelative(filepath)

		// if the filepath doesn't match the include we're done
		if (!minimatch(filepath, path.join(this.projectRoot, this.include))) {
			return false
		}

		// if there is an exclude, make sure the path doesn't match
		return !this.exclude ? true : !minimatch(filepath, this.exclude)
	}

	/*

		GraphqQL conventions

	*/

	get houdiniDirective() {
		return 'houdini'
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
		return this.listDirectiveParentIDArg
	}

	get listDirectiveParentIDArg() {
		return 'parentID'
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
				this.listDirectiveParentIDArg,
				this.whenDirective,
				this.whenNotDirective,
				this.argumentsDirective,
				this.withDirective,
				this.paginateDirective,
				this.cacheDirective,
				this.houdiniDirective,
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

	//// sveltekit conventions

	routeDataPath(filename: string) {
		// replace the .svelte with .js
		return this.resolveRelative(filename).replace('.svelte', '.js')
	}

	routePagePath(filename: string) {
		return this.resolveRelative(filename).replace('.js', '.svelte').replace('.ts', '.svelte')
	}

	isRouteScript(filename: string) {
		return (
			this.framework === 'kit' &&
			(filename.endsWith('+page.js') ||
				filename.endsWith('+page.ts') ||
				filename.endsWith('+layout.js') ||
				filename.endsWith('+layout.ts'))
		)
	}

	isRootLayout(filename: string) {
		return (
			this.resolveRelative(filename).replace(this.projectRoot, '') ===
			path.sep + path.join('src', 'routes', '+layout.svelte')
		)
	}

	isComponent(filename: string) {
		return (
			this.framework === 'svelte' ||
			(filename.endsWith('.svelte') &&
				!this.isRouteScript(filename) &&
				!this.isRoute(filename))
		)
	}

	pageQueryPath(filename: string) {
		return path.join(path.dirname(this.resolveRelative(filename)), this.pageQueryFilename)
	}

	resolveRelative(filename: string) {
		// kit generates relative import for our generated files. we need to fix that so that
		// vites importer can find the file.
		const match = filename.match('^((../)+)src/routes')
		if (match) {
			filename = path.join(this.projectRoot, filename.substring(match[1].length))
		}

		return filename
	}

	async walkRouteDir(visitor: RouteVisitor, dirpath = this.routesDir) {
		// if we run into any child with a query, we have a route
		let isRoute = false

		// we need to collect the important values from each special child
		// for the visitor.route handler
		let routeQuery: graphql.OperationDefinitionNode | null = null
		const inlineQueries: graphql.OperationDefinitionNode[] = []
		let routeScript: string | null = null

		// process the children
		for (const child of await fs.readdir(dirpath)) {
			const childPath = path.join(dirpath, child)
			// if we run into another directory, keep walking down
			if ((await fs.stat(childPath)).isDirectory()) {
				await this.walkRouteDir(visitor, childPath)
			}

			// route scripts
			else if (this.isRouteScript(child)) {
				isRoute = true
				routeScript = childPath
				if (!visitor.routeScript) {
					continue
				}
				await visitor.routeScript(childPath, childPath)
			}

			// route queries
			else if (child === this.pageQueryFilename) {
				isRoute = true

				// load the contents
				const contents = await fs.readFile(childPath)
				if (!contents) {
					continue
				}

				// invoke the visitor
				try {
					routeQuery = this.extractQueryDefinition(graphql.parse(contents))
				} catch (e) {
					throw routeQueryError(childPath)
				}

				if (!visitor.routeQuery) {
					continue
				}
				await visitor.routeQuery(routeQuery, childPath)
			}

			// inline queries
			else if (this.isComponent(child)) {
				// load the contents and parse it
				const contents = await fs.readFile(childPath)
				if (!contents) {
					continue
				}
				const parsed = await parseSvelte(contents)
				if (!parsed) {
					continue
				}

				// look for any graphql tags and invoke the walker's handler
				await walkGraphQLTags(this, parsed.script, {
					where: (tag) => {
						try {
							return !!this.extractQueryDefinition(tag)
						} catch {
							return false
						}
					},
					tag: async ({ parsedDocument }) => {
						isRoute = true

						let definition = this.extractQueryDefinition(parsedDocument)
						await visitor.inlineQuery?.(definition, childPath)
						inlineQueries.push(definition)
					},
				})
			}
		}

		// if this path is a route, invoke the handler
		if (visitor.route && isRoute) {
			await visitor.route(
				{
					dirpath,
					routeQuery,
					inlineQueries,
					routeScript,
				},
				dirpath
			)
		}
	}

	async extractLoadFunction(filepath: string): Promise<HoudiniRouteScript> {
		return await extractLoadFunction(this, filepath)
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
	let importPath = configPath
	if (os.platform() === 'win32') {
		importPath = 'file:///' + importPath
	}

	const imported = await import(importPath)

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
	if (glob.hasMagic(schemaPath)) {
		// the first step we have to do is grab a list of every file in the source tree
		const sourceFiles = await promisify(glob)(schemaPath)

		return mergeSchemas({
			typeDefs: await Promise.all(
				sourceFiles.map(async (filepath) => (await fs.readFile(filepath))!)
			),
		})
	}

	// the path has no glob magic, make sure its a real file
	if (!fs.stat(schemaPath)) {
		throw new Error(`Schema file does not exist! Create it using houdini generate -p`)
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
	configFile,
	...extraConfig
}: { configFile?: string } & Partial<ConfigFile> = {}): Promise<Config> {
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

	// add the filepath and save the result
	const configPath = configFile || DEFAULT_CONFIG_PATH

	try {
		_config = new Config({
			...(await readConfigFile(configPath)),
			...extraConfig,
			filepath: configPath,
		})

		// look up the schema if we need to
		if (_config.schemaPath && !_config.schema) {
			// we might have to pull the schema first
			if (_config.apiUrl) {
				// make sure we don't have a pattern pointing to multiple files and a remove URL
				if (glob.hasMagic(_config.schemaPath)) {
					console.log(
						`⚠️  Your houdini configuration contains an apiUrl and a path pointing to multiple files.
This will prevent your schema from being pulled (potentially resulting in errors).`
					)
				}
				// we might have to create the file
				else if (!(await fs.readFile(_config.schemaPath))) {
					console.log('⌛ Pulling schema from api')
					await pullSchema(_config.apiUrl, _config.schemaPath)
				}
			}

			// the schema is safe to load
			_config.schema = await loadSchemaFile(_config.schemaPath)
		}
	} catch (e) {
		reject(e)
		throw e
	}

	resolve(_config)

	return _config
}

export enum LogLevel {
	Full = 'full',
	Summary = 'summary',
	ShortSummary = 'short-summary',
	Quiet = 'quiet',
}

const posixify = (str: string) => str.replace(/\\/g, '/')

export type RouteVisitor = {
	routeQuery?: RouteVisitorHandler<graphql.OperationDefinitionNode>
	inlineQuery?: RouteVisitorHandler<graphql.OperationDefinitionNode>
	routeScript?: RouteVisitorHandler<string>
	route?: RouteVisitorHandler<{
		dirpath: string
		routeScript: string | null
		routeQuery: graphql.OperationDefinitionNode | null
		inlineQueries: graphql.OperationDefinitionNode[]
	}>
}

type RouteVisitorHandler<_Payload> = (value: _Payload, filepath: string) => Promise<void> | void

type RawHoudiniRouteScript = {
	houdini_load?: (string | GraphQLTagResult) | (string | GraphQLTagResult)[]
	[key: string]: any
}

export type HoudiniRouteScript = {
	houdini_load?: graphql.OperationDefinitionNode[]
	exports: string[]
}

const routeQueryError = (filepath: string) => ({
	filepath,
	message: 'route query error',
})
