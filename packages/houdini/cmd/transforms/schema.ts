// externals
import { Config, getRootType } from 'houdini-common'
import { mergeSchemas } from '@graphql-tools/merge'
import * as graphql from 'graphql'
// locals
import { CollectedGraphQLDocument } from '../types'
import { CachePolicy } from '../../runtime/types'

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
			enum CachePolicy {
				${CachePolicy.CacheAndNetwork}
				${CachePolicy.CacheOnly}
				${CachePolicy.CacheOrNetwork}
				${CachePolicy.NetworkOnly}
			}

			"""
				@${config.listDirective} is used to mark a field for the runtime as a place to add or remove
				entities in mutations
			"""
			directive @${config.listDirective}(${config.listNameArg}: String!, connection: Boolean) on FIELD

			"""
				@${config.listPrependDirective} is used to tell the runtime to add the result to the end of the list
			"""
			directive @${config.listPrependDirective}(
				${config.listDirectiveParentIDArg}: ID
			) on FRAGMENT_SPREAD

			"""
				@${config.listAppendDirective} is used to tell the runtime to add the result to the start of the list
			"""
			directive @${config.listAppendDirective}(${config.listDirectiveParentIDArg}: ID) on FRAGMENT_SPREAD

			"""
				@${config.listParentDirective} is used to provide a parentID without specifying position or in situations
				where it doesn't make sense (eg when deleting a node.)
			"""
			directive @${config.listParentDirective}(value: ID!) on FRAGMENT_SPREAD

			"""
				@${config.whenDirective} is used to provide a conditional or in situations where it doesn't make sense (eg when removing or deleting a node.)
			"""
			directive @${config.whenDirective} on FRAGMENT_SPREAD

			"""
				@${config.whenNotDirective} is used to provide a conditional or in situations where it doesn't make sense (eg when removing or deleting a node.)
			"""
			directive @${config.whenNotDirective} on FRAGMENT_SPREAD

			"""
				@${config.argumentsDirective} is used to define the arguments of a fragment
			"""
			directive @${config.argumentsDirective} on FRAGMENT_DEFINITION

			"""
				@${config.cacheDirective} is used to specify cache rules for a query
			"""
			directive @${config.cacheDirective}(${config.cachePolicyArg}: CachePolicy, ${config.cachePartialArg}: Boolean) on QUERY

		`),
		],
	})
}
