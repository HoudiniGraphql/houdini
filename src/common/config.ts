import { mergeSchemas } from '@graphql-tools/schema'
import fs from 'fs-extra'
import { glob } from 'glob'
import * as graphql from 'graphql'
import os from 'os'
import path from 'path'
import { promisify } from 'util'
// locals
import { computeID, ConfigFile, defaultConfigValues, keyFieldsForType } from '../runtime/lib'
import { CachePolicy } from '../runtime/lib/types'

// a place to hold conventions and magic strings
export class Config {
	filepath: string
	rootDir: string
	projectRoot: string
	schema: graphql.GraphQLSchema
	apiUrl?: string
	schemaPath?: string
	persistedQueryPath?: string
	sourceGlob: string
	static?: boolean
	scalars?: ConfigFile['scalars']
	framework: 'sapper' | 'kit' | 'svelte' = 'kit'
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

	constructor({ filepath, ...configFile }: ConfigFile & { filepath: string }) {
		this.configFile = defaultConfigValues(configFile)

		// apply defaults and pull out the values
		let {
			schema,
			schemaPath,
			sourceGlob,
			apiUrl,
			quiet = false,
			framework = 'kit',
			module = 'esm',
			static: staticSite,
			scalars,
			cacheBufferSize,
			definitionsPath,
			defaultCachePolicy = CachePolicy.CacheOrNetwork,
			defaultPartial = false,
			defaultKeys,
			types = {},
			logLevel,
			disableMasking = false,
		} = this.configFile

		// make sure we got some kind of schema
		if (!schema) {
			throw new Error('❌ Invalid config file: please provide one of schema or schema path')
		}

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

		if (framework === 'sapper') {
			console.warn(
				`⚠️ Support for sapper will be dropped in 0.16.0. ⚠️
If that's going to be a problem, please open a discussion on GitHub.`
			)
		}

		// save the values we were given
		this.schemaPath = schemaPath
		this.apiUrl = apiUrl
		this.filepath = filepath
		this.sourceGlob = sourceGlob
		this.framework = framework
		this.module = module
		this.projectRoot = path.dirname(filepath)
		this.static = staticSite
		this.scalars = scalars
		this.cacheBufferSize = cacheBufferSize
		this.defaultCachePolicy = defaultCachePolicy
		this.defaultPartial = defaultPartial
		this.definitionsFolder = definitionsPath
		this.logLevel = ((logLevel as LogLevel) || LogLevel.Summary).toLowerCase() as LogLevel
		this.disableMasking = disableMasking

		// if the user asked for `quiet` logging notify them its been deprecated
		if (quiet) {
			console.warn(
				`⚠️ The quiet configuration parameter has been deprecated. ⚠️
You should update your config to look like this:

export default {
    // ...
    logLevel: 'quiet'
}


For more information, visit this link: https://www.houdinigraphql.com/guides/migrating-to-0.15.0#config-values
`
			)
			this.logLevel = LogLevel.Summary
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

		// if we are building a sapper project, we want to put the runtime in
		// src/node_modules so that we can access @sapper/app and interact
		// with the application stores directly
		this.rootDir =
			framework === 'sapper'
				? path.join(this.projectRoot, 'src', 'node_modules', '$houdini')
				: path.join(this.projectRoot, '$houdini')
	}

	/*

		Directory structure

	*/

	// the directory where we put all of the artifacts
	get artifactDirectory() {
		return path.join(this.rootDir, this.artifactDirectoryName)
	}

	private get artifactDirectoryName() {
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

	private get storesDirectoryName() {
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

	get definitionsSchemaPath() {
		return path.join(this.definitionsDirectory, 'schema.graphql')
	}

	get definitionsDocumentsPath() {
		return path.join(this.definitionsDirectory, 'documents.gql')
	}

	get typeIndexPath() {
		return path.join(this.rootDir, 'index.d.ts')
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

	storeName({ name }: { name: string }) {
		return `GQL_${name}`
	}

	storeFactoryName(name: string): string {
		return name + 'Store'
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
			({ kind }) => graphql.Kind.OPERATION_DEFINITION
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
			return fragmentDefinitions.map((fragment) => fragment.name).join('_')
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
		])
	}

	/*

		GraphqQL conventions

	*/

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
				return fragmentName.substr(0, i)
			}
		}

		throw new Error('Could not find list name from fragment: ' + fragmentName)
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
				sourceFiles.map(async (filepath) => fs.readFile(filepath, 'utf-8'))
			),
		})
	}

	// the path has no glob magic, make sure its a real file
	if (!fs.stat(schemaPath)) {
		throw new Error(`Schema file does not exist! Create it using houdini generate -p`)
	}

	const contents = await fs.readFile(schemaPath, 'utf-8')

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

// get the project's current configuration
export async function getConfig(extraConfig?: Partial<ConfigFile>): Promise<Config> {
	if (_config) {
		return _config
	}

	// add the filepath and save the result
	const configPath = DEFAULT_CONFIG_PATH
	const config = await readConfigFile(configPath)

	// look up the schema
	let schema = config.schema
	if (config.schemaPath) {
		schema = await loadSchemaFile(config.schemaPath)
	}

	_config = new Config({
		schema,
		...config,
		...extraConfig,
		filepath: configPath,
	})
	return _config
}

export function testConfigFile(config: Partial<ConfigFile> = {}): ConfigFile {
	return {
		sourceGlob: '123',
		schema: `
			scalar Cursor

			type User implements Node {
				id: ID!
				firstName: String!
				friends: [User!]!
				friendsByCursor(first: Int, after: String, last: Int, before: String, filter: String): UserConnection!
				friendsByCursorScalar(first: Int, after: Cursor, last: Int, before: Cursor, filter: String): UserConnection!
				friendsByBackwardsCursor(last: Int, before: String, filter: String): UserConnectionScalar!
				friendsByForwardsCursor(first: Int, after: String, filter: String): UserConnection!
				friendsByOffset(offset: Int, limit: Int, filter: String): [User!]!
				friendsInterface: [Friend!]!
				believesIn: [Ghost!]!
				believesInConnection(first: Int, after: String, filter: String): GhostConnection!
				cats: [Cat!]!
				field(filter: String): String
			}

			type Ghost implements Friend {
				name: String!
				aka: String!
				believers: [User!]!
				friends: [Ghost!]!
				friendsConnection(first: Int, after: String): GhostConnection!
				legends: [Legend!]!
			}

			type Legend {
				name: String
				believers(first: Int, after: String): GhostConnection
			}

			type Cat implements Friend & Node {
				id: ID!
				name: String!
				owner: User!
			}

			type Query {
				user: User!
				version: Int!
				ghost: Ghost!
				ghosts: GhostConnection!
				friends: [Friend!]!
				users(boolValue: Boolean, intValue: Int, floatValue: Float, stringValue: String!): [User!]!
				entities: [Entity!]!
				usersByCursor(first: Int, after: String, last: Int, before: String): UserConnection!
				usersByBackwardsCursor(last: Int, before: String): UserConnection!
				usersByForwardsCursor(first: Int, after: String): UserConnection!
				usersByOffset(offset: Int, limit: Int): [User!]!
				node(id: ID!): Node
			}

			type PageInfo {
				hasPreviousPage: Boolean!
				hasNextPage: Boolean!
				startCursor: String!
				endCursor: String!
			}

			type UserEdge {
				cursor: String!
				node: User
			}

			type UserEdgeScalar {
				cursor: Cursor!
				node: User
			}

			type UserConnection {
				pageInfo: PageInfo!
				edges: [UserEdge!]!
			}

			type UserConnectionScalar {
				pageInfo: PageInfo!
				edges: [UserEdgeScalar!]!
			}

			type GhostEdge {
				cursor: String!
				node: Ghost
			}

			type GhostConnection {
				pageInfo: PageInfo!
				edges: [GhostEdge!]!
			}

			interface Friend {
				name: String!
			}

			union Entity = User | Cat | Ghost

			type Mutation {
				updateUser: User!
				addFriend: AddFriendOutput!
				believeIn: BelieveInOutput!
				deleteUser(id: ID!): DeleteUserOutput!
				catMutation: CatMutationOutput!
				deleteCat: DeleteCatOutput!
			}

			type Subscription {
				newUser: NewUserResult!
			}

			type NewUserResult {
				user: User!
			}

			type AddFriendOutput {
				friend: User!
			}

			type BelieveInOutput {
				ghost: Ghost
			}

			type DeleteUserOutput {
				userID: ID!
			}

			type DeleteCatOutput {
				catID: ID
			}

			type CatMutationOutput {
				cat: Cat
			}

			interface  Node {
				id: ID!
			}
		`,
		framework: 'kit',
		types: {
			Ghost: {
				keys: ['name', 'aka'],
				resolve: {
					queryField: 'ghost',
				},
			},
		},
		logLevel: LogLevel.Quiet,
		...config,
	}
}

export function testConfig(config: Partial<ConfigFile> = {}) {
	return new Config({
		filepath: path.join(process.cwd(), 'config.cjs'),
		...testConfigFile(config),
	})
}

type Partial<T> = {
	[P in keyof T]?: T[P]
}

export enum LogLevel {
	Full = 'full',
	Summary = 'summary',
	ShortSummary = 'short-summary',
	Quiet = 'quiet',
}
