import * as graphql from 'graphql'
import fs from 'fs'
import path from 'path'
import mkdirp from 'mkdirp'
import { file } from 'mock-fs/lib/filesystem'

// the values we can take in from the config file
export type ConfigFile = {
	sourceGlob: string
	schemaPath?: string
	schema?: string
	quiet?: boolean
	verifyHash?: boolean
	mode?: 'sapper' | 'kit'
}

// a place to hold conventions and magic strings
export class Config {
	filepath: string
	runtimeDirectory: string
	schema: graphql.GraphQLSchema
	sourceGlob: string
	quiet: boolean
	verifyHash: boolean

	constructor({
		schema,
		schemaPath,
		sourceGlob,
		quiet = false,
		verifyHash,
		filepath,
		mode = 'sapper',
	}: ConfigFile & { filepath: string }) {
		// make sure we got some kind of schema
		if (!schema && !schemaPath) {
			throw new Error('Please provide one of schema or schema path')
		}

		// if we're given a schema string
		if (schema) {
			this.schema = graphql.buildSchema(schema)
		} else {
			this.schema = graphql.buildClientSchema(
				JSON.parse(fs.readFileSync(schemaPath as string, 'utf-8'))
			)
		}

		// save the values we were given
		this.filepath = filepath
		this.sourceGlob = sourceGlob
		this.quiet = quiet
		this.verifyHash = typeof verifyHash === 'undefined' ? true : verifyHash

		// if we are building a sapper project, we want to put the runtime in
		// src/node_modules so that we can access @sapper/app and interact
		// with the application stores directly
		const rootDir = path.dirname(filepath)
		this.runtimeDirectory =
			mode === 'sapper'
				? path.join(rootDir, 'src', 'node_modules', '$houdini')
				: path.join(rootDir, '.houdini')
	}

	/*

		Directory structure

	*/

	// the directory where we put all of the artifacts
	get artifactDirectory() {
		return path.join(this.runtimeDirectory, 'artifacts')
	}

	// the directory where the mutation handlers live
	get patchDirectory() {
		return path.join(this.runtimeDirectory, 'patches')
	}

	// the directory where mutation links live
	get mutationLinksDirectory() {
		return path.join(this.runtimeDirectory, 'links')
	}

	// the directory where artifact types live
	get artifactTypeDirectory() {
		return this.artifactDirectory
	}

	get typeIndexPath() {
		return path.join(this.runtimeDirectory, 'index.d.ts')
	}

	artifactTypePath(document: graphql.DocumentNode) {
		return path.join(this.artifactTypeDirectory, `${this.documentName(document)}.d.ts`)
	}

	patchName({ query, mutation }: { query: string; mutation: string }) {
		return `${mutation}_${query}`
	}

	// the location for the artifact for a patch
	patchPath({ query, mutation }: { query: string; mutation: string }) {
		return path.join(this.patchDirectory, `${this.patchName({ query, mutation })}.js`)
	}

	// the location for the links associated with the provided mutation
	mutationLinksPath(mutationName: string): string {
		return path.join(this.mutationLinksDirectory, `${mutationName}.js`)
	}

	// the location of the artifact generated corresponding to the provided documents
	artifactPath(document: graphql.DocumentNode): string {
		// use the operation name for the artifact
		return path.join(this.artifactDirectory, `${this.documentName(document)}.cjs`)
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

	async createDirectories(): Promise<void> {
		await Promise.all([
			mkdirp(this.mutationLinksDirectory),
			mkdirp(this.artifactDirectory),
			mkdirp(this.artifactTypeDirectory),
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

	isFragmentForConnection(connectionName: string, fragmentName: string) {
		return fragmentName.startsWith(connectionName)
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

export function testConfig(config: {} = {}) {
	return new Config({
		filepath: path.join(process.cwd(), 'config.cjs'),
		sourceGlob: '123',
		schema: `
			type User {
				id: ID!
				firstName: String!
				friends: [User!]!
				believesIn: [Ghost!]!
				cats: [Cat!]!
			}

			type Ghost {
				name: String!
				believers: [User!]!
				friends: [Ghost!]!
			}

			type Cat {
				id: ID!
				name: String
			}

			type Query {
				user: User!
				version: Int!
				ghost: Ghost!
				users(boolValue: Boolean, intValue: Int, floatValue: Float, stringValue: String!): [User!]!
			}

			type Mutation {
				updateUser: User!
				addFriend: AddFriendOutput!
				believeIn: BelieveInOutput!
				deleteUser(id: ID!): DeleteUserOutput!
				catMutation: CatMutationOutput!
				deleteCat: DeleteCatOutput!
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
		quiet: true,
		...config,
	})
}

// a place to store the current configuration
let _config: Config

// get the project's current configuration
export async function getConfig(): Promise<Config> {
	if (_config) {
		return _config
	}

	// load the config file
	const configPath = path.join(process.cwd(), 'houdini.config.cjs')
	const config = await import(configPath)

	// add the filepath
	return new Config({
		...config,
		filepath: configPath,
	})
}
