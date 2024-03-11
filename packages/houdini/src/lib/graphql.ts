import * as graphql from 'graphql'
import crypto from 'node:crypto'

import type { Document, Config } from '.'
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

export function processComponentFieldDirective(directive: graphql.DirectiveNode): {
	field: string
	prop: string
	export?: string
	raw?: string
} {
	let field: string | undefined
	let exportValue: string | undefined
	let prop: string | undefined
	let raw: string | undefined

	for (const arg of directive.arguments ?? []) {
		// if we are looking at the field argument
		if (arg.name.value === 'field' && arg.value.kind === 'StringValue') {
			field = arg.value.value
		}
		// if we are looking at the export argument
		else if (arg.name.value === 'export' && arg.value.kind === 'StringValue') {
			exportValue = arg.value.value
		}
		// if we are looking at the prop argument
		else if (arg.name.value === 'prop' && arg.value.kind === 'StringValue') {
			prop = arg.value.value
		}
		// if we are looking at the raw argument
		else if (arg.name.value === 'raw' && arg.value.kind === 'StringValue') {
			raw = arg.value.value
		}
	}

	// make sure we have the required args
	const missing = []
	if (!field) {
		missing.push('field')
	}
	if (!prop) {
		missing.push('prop')
	}
	if (missing.length > 0) {
		throw new Error(`missing arguments to @componentField: ${missing.join(', ')}`)
	}

	// we're done
	return {
		prop: prop!,
		field: field!,
		raw,
		export: exportValue,
	}
}

export function hashOriginal({ document }: { document: Document }): string {
	return hashDocument(document.originalString)
}

export function hashRaw({ document }: { document: Document }): string {
	return hashDocument(document.artifact?.raw)
}

function hashDocument(str?: string): string {
	// hash the string
	return crypto
		.createHash('sha256')
		.update(str || '')
		.digest('hex')
}

type GraphQLParentType =
	| graphql.GraphQLObjectType
	| graphql.GraphQLInputObjectType
	| graphql.GraphQLInterfaceType

export function parentField(
	ancestors: readonly any[]
):
	| graphql.FieldNode
	| graphql.InlineFragmentNode
	| graphql.OperationDefinitionNode
	| graphql.FragmentDefinitionNode
	| null {
	return walkParentField([...ancestors].sort(() => -1))
}

function walkParentField(
	ancestors: any[]
):
	| graphql.FieldNode
	| graphql.InlineFragmentNode
	| graphql.OperationDefinitionNode
	| graphql.FragmentDefinitionNode
	| null {
	let head = ancestors.shift()
	// if it was an array or a selection set, skip it
	if (Array.isArray(head) || head.kind === 'SelectionSet') {
		return walkParentField(ancestors)
	}

	return head
}

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

	return { parents, definition }
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

export function unwrapType(
	config: Config,
	type: any,
	wrappers: TypeWrapper[] = [],
	convertRuntimeScalars?: boolean
): { type: graphql.GraphQLNamedType; wrappers: TypeWrapper[] } {
	// if we are looking at a non null type
	if (type.kind === 'NonNullType') {
		return unwrapType(config, type.type, [TypeWrapper.NonNull, ...wrappers])
	}
	if (type instanceof graphql.GraphQLNonNull) {
		return unwrapType(config, type.ofType, [TypeWrapper.NonNull, ...wrappers])
	}

	// if the last thing we added was not a non-null indicator
	if (wrappers[0] !== TypeWrapper.NonNull) {
		// add the nullable mark
		wrappers.unshift(TypeWrapper.Nullable)
	}

	if (type.kind === 'ListType') {
		return unwrapType(config, type.type, [TypeWrapper.List, ...wrappers])
	}
	if (type instanceof graphql.GraphQLList) {
		return unwrapType(config, type.ofType, [TypeWrapper.List, ...wrappers])
	}

	// if we got this far and the type is a runtime scalar, we need to use the underlying type
	if (convertRuntimeScalars && config.configFile.features?.runtimeScalars?.[type.name.value]) {
		type = config.schema.getType(
			config.configFile.features?.runtimeScalars?.[type.name.value].type
		)
	}

	// get the named type
	const namedType = config.schema.getType(type.name.value || type.name)
	if (!namedType) {
		throw new Error('Unknown type: ' + type.name.value || type.name)
	}

	// don't add any wrappers
	return { type: namedType, wrappers }
}

export function wrapType({
	type,
	wrappers,
}: {
	type: graphql.GraphQLNamedType
	wrappers: TypeWrapper[]
}): graphql.TypeNode {
	const head = wrappers[0]
	const tail = wrappers.slice(1)

	let kind: graphql.TypeNode['kind'] = graphql.Kind.NAMED_TYPE
	if (head === TypeWrapper.List) {
		kind = graphql.Kind.LIST_TYPE
	} else if (head === TypeWrapper.NonNull) {
		kind = graphql.Kind.NON_NULL_TYPE
	}

	if (kind === 'NamedType') {
		return {
			kind,
			name: {
				kind: graphql.Kind.NAME,
				value: type.name,
			},
		}
	}

	return {
		kind,
		// @ts-ignore
		type: wrapType({ type, wrappers: tail }),
	}
}

export enum TypeWrapper {
	Nullable = 'Nullable',
	List = 'List',
	NonNull = 'NonNull',
}
