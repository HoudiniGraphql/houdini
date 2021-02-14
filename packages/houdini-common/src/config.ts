import * as graphql from 'graphql'
import fs from 'fs'
import path from 'path'
import mkdirp from 'mkdirp'

// the values we can take in from the config file
export type ConfigFile = {
	runtimeDirectory: string
	sourceGlob: string
	schemaPath?: string
	schema?: string
	quiet?: boolean
}

// a place to hold conventions and magic strings
export class Config {
	runtimeDirectory: string
	schema: graphql.GraphQLSchema
	sourceGlob: string
	quiet: boolean

	constructor({ runtimeDirectory, schema, schemaPath, sourceGlob, quiet = false }: ConfigFile) {
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

		// hold onto the artifact directory
		this.runtimeDirectory = runtimeDirectory
		this.sourceGlob = sourceGlob
		this.quiet = quiet
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
		return path.join(this.artifactDirectory, `${this.documentName(document)}.js`)
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

	isInsertFragment(name: string) {
		return name.endsWith(this.insertFragmentSuffix)
	}

	isRemoveFragment(name: string) {
		return name.endsWith(this.removeFragmentSuffix)
	}

	get removeFragmentSuffix() {
		return `_remove`
	}

	connectionInsertFragment(name: string): string {
		return name + this.insertFragmentSuffix
	}

	connectionRemoveFragment(name: string): string {
		return name + this.removeFragmentSuffix
	}

	isInternalDirective({ name }: graphql.DirectiveNode): boolean {
		return [
			this.connectionDirective,
			this.connectionPrependDirective,
			this.connectionAppendDirective,
			this.connectionDirectiveParentIDArg,
		].includes(name.value)
	}

	isConnectionFragment(name: string): boolean {
		return name.endsWith(this.insertFragmentSuffix) || name.endsWith(this.removeFragmentSuffix)
	}
}

export function testConfig(config: {} = {}) {
	return new Config({
		runtimeDirectory: path.resolve(process.cwd(), '__tests__'),
		sourceGlob: '123',
		schema: `
			type User {
				id: ID!
				firstName: String!
				friends: [User!]!
				believesIn: [Ghost!]!
			}

			type Ghost {
				name: String!
				believers: [User!]!
				friends: [Ghost!]!
			}

			type Query {
				user: User!
				version: Int!
				ghost: Ghost!
			}

			type Mutation {
				updateUser: User!
				addFriend: AddFriendOutput!
				believeIn: BelieveInOutput!
				deleteUser(id: ID!): DeleteUserOutput!
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

	return new Config(await import(path.join(process.cwd(), 'houdini.config')))
}
