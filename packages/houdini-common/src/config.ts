import * as graphql from 'graphql'
import fs from 'fs'
import path from 'path'
import mkdirp from 'mkdirp'
import os from 'os'

// the values we can take in from the config file
export type ConfigFile = {
	sourceGlob: string
	schemaPath?: string
	schema?: string
	quiet?: boolean
	apiUrl?: string
	// an old config file could specify mode instead of framework and module
	mode?: 'kit' | 'sapper'
	framework?: 'kit' | 'sapper' | 'svelte'
	module?: 'esm' | 'commonjs'
	static?: boolean
}

// a place to hold conventions and magic strings
export class Config {
	filepath: string
	rootDir: string
	projectRoot: string
	schema: graphql.GraphQLSchema
	apiUrl?: string
	schemaPath?: string
	sourceGlob: string
	quiet: boolean
	static?: boolean
	framework: 'sapper' | 'kit' | 'svelte' = 'sapper'
	module: 'commonjs' | 'esm' = 'commonjs'

	constructor({
		schema,
		schemaPath,
		sourceGlob,
		apiUrl,
		quiet = false,
		filepath,
		framework = 'sapper',
		module = 'commonjs',
		static: staticSite,
		mode,
	}: ConfigFile & { filepath: string }) {
		// make sure we got some kind of schema
		if (!schema && !schemaPath) {
			throw new Error('Please provide one of schema or schema path')
		}

		// if we're given a schema string
		if (schema) {
			this.schema = graphql.buildSchema(schema)
		} else if (schemaPath!.endsWith('gql') || schemaPath!.endsWith('graphql')) {
			this.schema = graphql.buildSchema(fs.readFileSync(schemaPath as string, 'utf-8'))
		} else {
			this.schema = graphql.buildClientSchema(
				JSON.parse(fs.readFileSync(schemaPath as string, 'utf-8'))
			)
		}

		// if we were given a mode instead of framework/module
		if (mode) {
			if (!quiet) {
				// warn the user
				console.warn('Encountered deprecated config value: mode')
				console.warn(
					'This parameter will be removed in a future version. Please update your config with the following values:'
				)
			}
			if (mode === 'sapper') {
				if (!quiet) {
					console.warn(JSON.stringify({ framework: 'sapper', module: 'commonjs' }))
				}
				framework = 'sapper'
				module = 'commonjs'
			} else {
				if (!quiet) {
					console.warn(JSON.stringify({ framework: 'kit', module: 'esm' }))
				}
				framework = 'kit'
				module = 'esm'
			}
		}

		// save the values we were given
		this.schemaPath = schemaPath
		this.apiUrl = apiUrl
		this.filepath = filepath
		this.sourceGlob = sourceGlob
		this.quiet = quiet
		this.framework = framework
		this.module = module
		this.projectRoot = path.dirname(filepath)
		this.static = staticSite

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

	// where we will place the runtime
	get runtimeDirectory() {
		return path.join(this.rootDir, 'runtime')
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
		return ['String', 'ID', 'Float', 'Int', 'Boolean'].includes(type)
	}

	async createDirectories(): Promise<void> {
		await Promise.all([
			mkdirp(this.artifactDirectory),
			mkdirp(this.artifactTypeDirectory),
			mkdirp(this.runtimeDirectory),
		])
	}

	/*

		GraphqQL conventions

	*/

	get connectionDirective() {
		return 'connection'
	}

	get connectionPrependDirective() {
		return 'prepend'
	}

	get connectionAppendDirective() {
		return 'append'
	}

	get connectionParentDirective() {
		return this.connectionDirectiveParentIDArg
	}

	get connectionDirectiveParentIDArg() {
		return 'parentID'
	}

	get connectionNameArg() {
		return 'name'
	}

	get insertFragmentSuffix() {
		return `_insert`
	}

	get removeFragmentSuffix() {
		return `_remove`
	}

	get deleteDirectiveSuffix() {
		return `_delete`
	}

	isDeleteDirective(name: string) {
		return name.endsWith(this.deleteDirectiveSuffix)
	}

	connectionDeleteDirective(name: string): string {
		return name + this.deleteDirectiveSuffix
	}

	deleteDirectiveType(name: string) {
		return name.slice(0, name.length - this.deleteDirectiveSuffix.length)
	}

	isInsertFragment(name: string) {
		return name.endsWith(this.insertFragmentSuffix)
	}

	connectionInsertFragment(name: string): string {
		return name + this.insertFragmentSuffix
	}

	isRemoveFragment(name: string) {
		return name.endsWith(this.removeFragmentSuffix)
	}

	connectionRemoveFragment(name: string): string {
		return name + this.removeFragmentSuffix
	}

	isInternalDirective({ name }: graphql.DirectiveNode): boolean {
		return (
			[
				this.connectionDirective,
				this.connectionPrependDirective,
				this.connectionAppendDirective,
				this.connectionDirectiveParentIDArg,
				'when',
				'when_not',
			].includes(name.value) || this.isDeleteDirective(name.value)
		)
	}

	isConnectionFragment(name: string): boolean {
		return name.endsWith(this.insertFragmentSuffix) || name.endsWith(this.removeFragmentSuffix)
	}

	isConnectionOperationDirective(name: string): boolean {
		return name.endsWith(this.deleteDirectiveSuffix)
	}

	isFragmentForConnection(connectionName: string, fragmentName: string) {
		return fragmentName.startsWith(connectionName)
	}

	// return 'insert' for All_Users_insert
	connectionOperationFromFragment(fragmentName: string): 'insert' | 'remove' {
		// check the name against the fragment patterns
		if (this.isInsertFragment(fragmentName)) {
			return 'insert'
		} else if (this.isRemoveFragment(fragmentName)) {
			return 'remove'
		}

		throw new Error(
			'Could not determine connection operation from fragment name: ' + fragmentName
		)
	}

	connectionNameFromDirective(directiveName: string): string {
		try {
			return this.connectionNameFromFragment(directiveName)
		} catch (e) {
			throw new Error('Could not find connection name from directive: ' + directiveName)
		}
	}

	connectionNameFromFragment(fragmentName: string): string {
		// starting at the end of the fragment name going left, look for a _
		for (let i = fragmentName.length - 1; i >= 0; i--) {
			// if we hit a _
			if (fragmentName[i] === '_') {
				return fragmentName.substr(0, i)
			}
		}

		throw new Error('Could not find connection name from fragment: ' + fragmentName)
	}
}
// a place to store the current configuration
let _config: Config

// get the project's current configuration
export async function getConfig(): Promise<Config> {
	if (_config) {
		return _config
	}

	// load the config file
	const configPath = path.join(process.cwd(), 'houdini.config.js')

	// on windows, we need to prepend the right protocol before we
	// can import from an absolute path
	let importPath = configPath
	if (os.platform() === 'win32') {
		importPath = 'file:///' + importPath
	}

	const imported = await import(importPath)

	// if this is wrapped in a default, use it
	const config = imported.default || imported

	// add the filepath and save the result
	_config = new Config({
		...config,
		filepath: configPath,
	})
	return _config
}

export function testConfig(config: Partial<ConfigFile> = {}) {
	return new Config({
		filepath: path.join(process.cwd(), 'config.cjs'),
		sourceGlob: '123',
		schema: `
			type User {
				id: ID!
				firstName: String!
				friends: [User!]!
				friendsInterface: [Friend!]!
				believesIn: [Ghost!]!
				cats: [Cat!]!
			}

			type Ghost implements Friend {
				name: String!
				aka: String!
				believers: [User!]!
				friends: [Ghost!]!
			}

			type Cat implements Friend {
				id: ID!
				name: String!
				owner: User!
			}

			type Query {
				user: User!
				version: Int!
				ghost: Ghost!
				friends: [Friend!]!
				users(boolValue: Boolean, intValue: Int, floatValue: Float, stringValue: String!): [User!]!
				entities: [Entity!]!
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
				friend: User
			}

			type BelieveInOutput {
				ghost: Ghost
			}

			type DeleteUserOutput {
				userID: ID
			}

			type DeleteCatOutput {
				catID: ID
			}

			type CatMutationOutput {
				cat: Cat
			}
		`,
		framework: 'sapper',
		quiet: true,
		...config,
	})
}

type Partial<T> = {
	[P in keyof T]?: T[P]
}
