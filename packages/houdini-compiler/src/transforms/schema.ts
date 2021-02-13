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
				@connection is used to mark a field for the runtime as a place to add or remove
				entities in mutations
			"""
			directive @${config.connectionDirective}(${config.connectionNameArg}: String!) on FIELD

			"""
				@prepend is used to tell the runtime to add the result to the end of the list
			"""
			directive @${config.connectionPrependDirective}(${config.connectionDirectiveParentIDArg}: ID) on FRAGMENT_SPREAD

			"""
				@append is used to tell the runtime to add the result to the start of the list
			"""
			directive @${config.connectionAppendDirective}(${config.connectionDirectiveParentIDArg}: ID) on FRAGMENT_SPREAD
		`),
		],
	})
}
