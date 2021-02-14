// externals
import { Config, getRootType } from 'houdini-common'
import { mergeSchemas } from '@graphql-tools/merge'
import * as graphql from 'graphql'

// locals
import { CollectedGraphQLDocument } from '../types'

// graphqlExtensions adds a few different things to the graphql schema
export default async function graphqlExtensions(
	config: Config,
	documents: CollectedGraphQLDocument[]
): Promise<void> {
	// add the static extra bits that will be used by other transforms
	config.schema = mergeSchemas({
		schemas: [
			config.schema,
			graphql.buildSchema(`
			"""
				@${config.connectionDirective} is used to mark a field for the runtime as a place to add or remove
				entities in mutations
			"""
			directive @${config.connectionDirective}(${config.connectionNameArg}: String!) on FIELD

			"""
				@${config.connectionPrependDirective} is used to tell the runtime to add the result to the end of the list
			"""
			directive @${config.connectionPrependDirective}(${config.connectionDirectiveParentIDArg}: ID) on FRAGMENT_SPREAD

			"""
				@${config.connectionAppendDirective} is used to tell the runtime to add the result to the start of the list
			"""
			directive @${config.connectionAppendDirective}(${config.connectionDirectiveParentIDArg}: ID) on FRAGMENT_SPREAD

			"""
				@${config.connectionParentDirective} is used to provide a parentID without specifying position or in situations
				where it doesn't make sense (eg when deleting a node.)
			"""
			directive @${config.connectionParentDirective}(value: ID!) on FRAGMENT_SPREAD

		`),
		],
	})
}
