// externals
import { Config } from 'houdini-common'
import { mergeSchemas } from '@graphql-tools/merge'
import * as graphql from 'graphql'

// locals
import { CollectedGraphQLDocument } from '../types'

// includeFragmentDefinitions adds any referenced fragments to operations
export default async function includeFragmentDefinitions(
	config: Config,
	documents: CollectedGraphQLDocument[]
): Promise<void> {
	config.schema = mergeSchemas({
		schemas: [config.schema, internalSchema],
	})
}

// we want to add some things to the schema that the rest of the compiler toolchain
// can use
const internalSchema = graphql.buildSchema(`
    """
        @connection is used to mark a field for the runtime as a place to add or remove
        entities in mutations
    """
    directive @connection(name: String) on FIELD

    """
        @prepend is used to tell the runtime to add the result to the end of the list
    """
    directive @prepend on FRAGMENT_SPREAD

    """
        @append is used to tell the runtime to add the result to the start of the list
    """
    directive @append on FRAGMENT_SPREAD

`)
