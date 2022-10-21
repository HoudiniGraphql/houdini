import crypto from 'crypto'
import * as graphql from 'graphql'

import { HoudiniError } from './error'
import * as path from './path'

export function getRootType(type: graphql.GraphQLType): graphql.GraphQLType {
	// if the type is non-null, unwrap and go again
	if (graphql.isNonNullType(type)) {
		return getRootType((type as graphql.GraphQLNonNull<any>).ofType)
	}

	// if the type is non-null, unwrap and go again
	if (graphql.isListType(type)) {
		return getRootType((type as graphql.GraphQLList<any>).ofType)
	}

	// we've unwrapped everything
	return type
}

export function hashDocument(document: string | graphql.DocumentNode): string {
	// if we were given an AST document, print it first
	const docString = typeof document === 'string' ? document : graphql.print(document)

	// hash the string
	return crypto.createHash('sha256').update(docString).digest('hex')
}

type GraphQLParentType =
	| graphql.GraphQLObjectType
	| graphql.GraphQLInputObjectType
	| graphql.GraphQLInterfaceType

export function parentTypeFromAncestors(
	schema: graphql.GraphQLSchema,
	filepath: string,
	ancestors: readonly any[]
) {
	const parents = [...ancestors] as (
		| graphql.OperationDefinitionNode
		| graphql.FragmentDefinitionNode
		| graphql.SelectionNode
	)[]
	parents.reverse()

	return walkAncestors(schema, filepath, parents)
}

function walkAncestors(
	schema: graphql.GraphQLSchema,
	filepath: string,
	ancestors: (
		| graphql.OperationDefinitionNode
		| graphql.FragmentDefinitionNode
		| graphql.SelectionNode
		| graphql.SelectionSetNode
	)[]
): GraphQLParentType {
	// get the front node
	let head = ancestors.shift()
	// if it was a list, skip it
	if (Array.isArray(head)) {
		return walkAncestors(schema, filepath, ancestors)
	}

	if (!head) {
		throw new HoudiniError({ filepath, message: 'Could not figure out type of field' })
	}

	// if we are at the top of the definition stack
	if (head.kind === 'OperationDefinition') {
		// grab the appropriate
		const operationType = {
			query: schema.getQueryType(),
			mutation: schema.getMutationType(),
			subscription: schema.getSubscriptionType(),
		}[head.operation]

		if (!operationType) {
			throw new HoudiniError({ filepath, message: 'Could not find operation type' })
		}
		return operationType
	}

	if (head.kind === 'FragmentDefinition') {
		// look up the type condition in the schema
		const result = schema.getType(head.typeCondition.name.value) as GraphQLParentType
		if (!result) {
			throw new HoudiniError({
				filepath,
				message: `Could not find definition for ${head.typeCondition.name.value} in the schema`,
			})
		}

		// we're done here
		return result
	}

	// if we are looking at a fragment spread there is a serious problem
	if (head.kind === 'FragmentSpread') {
		throw new Error('How the hell did this happen?')
	}

	// grab our parent type
	const parent = walkAncestors(schema, filepath, ancestors)

	// if we are looking at an inline fragment
	if (head.kind === 'InlineFragment') {
		// if there is no type condition, then our parents type is the answer
		if (!head.typeCondition) {
			return parent
		}

		// look at the type condition to find the type
		const wrapper = schema.getType(head.typeCondition.name.value) as GraphQLParentType
		if (!wrapper) {
			throw new HoudiniError({
				filepath,
				message: 'Could not find type with name: ' + head.typeCondition.name.value,
			})
		}

		return wrapper
	}

	// we are looking at a selection select our type is our parent's type
	if (head.kind === 'SelectionSet') {
		return parent
	}
	// we are looking at a field so we can just access the field map of the parent type
	const field = parent.getFields()[head.name.value]
	if (!field) {
		throw new HoudiniError({
			filepath,
			message: `Could not find definition of ${head.name.value} in ${parent.toString()}`,
		})
	}

	return getRootType(field.type) as GraphQLParentType
}

export function definitionFromAncestors(ancestors: readonly any[]) {
	// in order to look up field type information we have to start at the parent
	// and work our way down
	// note:  the top-most parent is always gonna be a document so we ignore it
	let parents = [...ancestors] as (
		| graphql.FieldNode
		| graphql.InlineFragmentNode
		| graphql.FragmentDefinitionNode
		| graphql.OperationDefinitionNode
		| graphql.SelectionSetNode
	)[]
	parents.shift()

	// the first meaningful parent is a definition of some kind
	let definition = parents.shift() as
		| graphql.FragmentDefinitionNode
		| graphql.OperationDefinitionNode
	while (Array.isArray(definition) && definition) {
		// @ts-ignore
		definition = parents.shift()
	}

	return definition
}

export function formatErrors(e: unknown, afterError?: (e: Error) => void) {
	// we need an array of errors to loop through
	const errors = (Array.isArray(e) ? e : [e]) as (Error & {
		filepath?: string
		description?: string
	})[]

	for (const error of errors) {
		// if we have filepath, show that to the user
		if ('filepath' in error && error.filepath) {
			const relative = path.relative(process.cwd(), error.filepath)
			console.error(`❌ Encountered error in ${relative}`)
			if (error.message) {
				console.error(error.message)
			}
		} else {
			console.error(`❌ ${error.message}`)
			if ('description' in error && error.description) {
				console.error(`${error.description}`)
			}
		}
		afterError?.(e as Error)
	}
}

export function operation_requires_variables(operation: graphql.OperationDefinitionNode) {
	return Boolean(
		operation.variableDefinitions &&
			operation.variableDefinitions?.find(
				(defn) => defn.type.kind === 'NonNullType' && !defn.defaultValue
			)
	)
}
