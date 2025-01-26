import { mergeTypeDefs } from '@graphql-tools/merge'
import * as graphql from 'graphql'

import type { Config, Document } from '../../lib'
import { siteURL } from '../../lib'
import { CachePolicy, DedupeMatchMode, PaginateMode } from '../../runtime/lib/types'
import { fragmentArguments } from './fragmentVariables'

// graphqlExtensions adds a few different things to the graphql schema
export default async function graphqlExtensions(
	config: Config,
	documents: Document[]
): Promise<void> {
	// the bits to add to the schema
	let internalSchema = `
enum CachePolicy {
	${CachePolicy.CacheAndNetwork}
	${CachePolicy.CacheOnly}
	${CachePolicy.CacheOrNetwork}
	${CachePolicy.NetworkOnly}
	${CachePolicy.NoCache}
}

"""
	The ${config.componentScalar} scalar is only defined if the user has any component fields
"""
${Object.keys(config.componentFields).length > 0 ? `scalar ${config.componentScalar}` : ''}

enum PaginateMode {
	${PaginateMode.Infinite}
	${PaginateMode.SinglePage}
}

"""
	@${config.listDirective} is used to mark a field for the runtime as a place to add or remove
	entities in mutations
"""
directive @${config.listDirective}(${
		config.listOrPaginateNameArg
	}: String!, connection: Boolean) on FIELD

"""
	@${config.paginateDirective} is used to to mark a field for pagination.
	More info in the [doc](${siteURL}/guides/pagination).
"""
directive @${config.paginateDirective}(${config.listOrPaginateNameArg}: String, ${
		config.paginateModeArg
	}: PaginateMode) on FIELD

"""
	@${config.listPrependDirective} is used to tell the runtime to add the result to the end of the list
"""
directive @${config.listPrependDirective} on FRAGMENT_SPREAD

enum DedupeMatchMode {
	${DedupeMatchMode.Variables}
	${DedupeMatchMode.Operation}
	${DedupeMatchMode.None}
}

"""
	@${
		config.dedupeDirective
	} is used to prevent an operation from running more than once at the same time.
	If the cancelFirst arg is set to true, the response already in flight will be canceled instead of the second one.
	If match is set to Operation, then a request will be deduplicated any time there is a request with the same operation.
	If it's set to Variables then the request will only be deduplicated if the variables match. If match is set to None,
	then the request will never be deduplicated.
"""
directive @${
		config.dedupeDirective
	}(cancelFirst: Boolean, match: DedupeMatchMode) on QUERY | MUTATION

"""
	@${config.optimisticKeyDirective} is used to identify a field as an optimistic key
"""
directive @${config.optimisticKeyDirective} on FIELD

"""
	@${
		config.listAppendDirective
	} is used to tell the runtime to add the result to the start of the list
"""
directive @${config.listAppendDirective} on FRAGMENT_SPREAD

"""
	@${config.listAllListsDirective} is used to tell the runtime to add the result to all list
"""
directive @${config.listAllListsDirective} on FRAGMENT_SPREAD

"""
	@${
		config.listParentDirective
	} is used to provide a parentID without specifying position or in situations
	where it doesn't make sense (eg when deleting a node.)
"""
directive @${config.listParentDirective}(value: ID!) on FRAGMENT_SPREAD


"""
	@${
		config.whenDirective
	} is used to provide a conditional or in situations where it doesn't make sense (eg when removing or deleting a node.)
"""
directive @${config.whenDirective} on FRAGMENT_SPREAD

"""
	@${
		config.whenNotDirective
	} is used to provide a conditional or in situations where it doesn't make sense (eg when removing or deleting a node.)
"""
directive @${config.whenNotDirective} on FRAGMENT_SPREAD

"""
	@${config.argumentsDirective} is used to define the arguments of a fragment
"""
directive @${config.argumentsDirective} on FRAGMENT_DEFINITION

"""
	@${config.withDirective} is used to provide arguments to fragments that have been marked with @${
		config.argumentsDirective
	}
"""
directive @${config.withDirective} on FRAGMENT_SPREAD

"""
	@${config.cacheDirective} is used to specify cache rules for a query
"""
directive @${config.cacheDirective}(${config.cachePolicyArg}: CachePolicy, ${
		config.cachePartialArg
	}: Boolean) on QUERY

"""
	@${config.maskEnableDirective} to enable masking on fragment (overwriting the global conf)
"""
directive @${config.maskEnableDirective} on FRAGMENT_SPREAD

"""
	@${config.maskDisableDirective} to disable masking on fragment (overwriting the global conf)
"""
directive @${config.maskDisableDirective} on FRAGMENT_SPREAD

"""
	@${config.loadingDirective} is used to shape the value of your documents while they are loading
"""
directive @${
		config.loadingDirective
	}(count: Int, cascade: Boolean) on QUERY | FRAGMENT_DEFINITION | FIELD | FRAGMENT_SPREAD

"""
	@${
		config.requiredDirective
	} makes a nullable field always non-null by making the parent null when the field is
"""
directive @${config.requiredDirective} on FIELD

${
	config.configFile.features?.componentFields
		? `
"""
@${config.componentFieldDirective} marks an inline fragment as the selection for a component field
"""
directive @${config.componentFieldDirective}(field: String!, prop: String, export: String, raw: String) on FRAGMENT_DEFINITION | INLINE_FRAGMENT | FIELD_DEFINITION

`
		: ''
}

`

	// add each custom schema to the internal value
	for (const plugin of config.plugins) {
		// if the plugin doesn't add a schema, ignore it
		if (!plugin.schema) {
			continue
		}

		// add the schema value
		internalSchema += plugin.schema({ config })
	}

	let extensions = Object.entries(config.componentFields)
		.map(([parent, fields]) => {
			return `
		extend type ${parent} {
			${Object.entries(fields)
				.map(([fieldName, field]) => {
					// figure out the arguments to the field
					let argString = ''
					// look for a @arguments directive on the same node that was tagged as a componentField
					const args = fragmentArguments(config, '', field.parent)
					if (args.length > 0) {
						argString =
							'(' +
							args
								.map((arg) => {
									// figure out the name of the type
									const typeName = graphql.print(arg.type)

									// add the ! if its required
									return `${arg.name}:${typeName}${arg.required ? '!' : ''}`
								})
								.join('\n') +
							')'
					}

					return `${fieldName}${argString}: ${config.componentScalar}!  @componentField(field: "${fieldName}")`
				})
				.join('\n')}
		}
	`
		})
		.join('\n')

	// runtime scalars need their own entries in the graphql schema
	extensions += `${Object.keys(config.configFile.features?.runtimeScalars ?? {})
		.map((scalar) => `scalar ${scalar}`)
		.join('\n')}`

	// newSchema holds the schema elements that we need to remove from queries (eg added by plugins)
	config.newSchema = graphql.print(mergeTypeDefs([internalSchema]))

	// schemaString is the value that gets printed to disk to extend the user's schema
	// it gets updated when newSchema is set so we just need to add the extensions
	config.schemaString += extensions.replaceAll('extend type', 'type')

	// build up the full schema by mixing everything together
	config.schema = graphql.buildSchema(
		graphql.print(
			mergeTypeDefs([graphql.printSchema(config.schema), internalSchema, extensions])
		)
	)
}
