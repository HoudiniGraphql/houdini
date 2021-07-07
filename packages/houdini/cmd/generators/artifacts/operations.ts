// externals
import { namedTypes } from 'ast-types/gen/namedTypes'
import { Config, parentTypeFromAncestors } from 'houdini-common'
import { ListWhen, MutationOperation } from '../../../runtime'
import * as recast from 'recast'
import * as graphql from 'graphql'

const AST = recast.types.builders

// return the list of operations that are part of a mutation
export function operationsByPath(
	config: Config,
	definition: graphql.OperationDefinitionNode,
	filterTypes: FilterMap
): { [path: string]: namedTypes.ArrayExpression } {
	// map the path in the response to the list of operations that treat it as the source
	const pathOperations: { [path: string]: namedTypes.ArrayExpression } = {}

	// we need to look for three different things in the operation:
	// - insert fragments
	// - remove fragments
	// - delete directives
	//
	// note: for now, we're going to ignore the possibility that fragments
	// inside of the mutation could contain operations
	graphql.visit(definition, {
		FragmentSpread(node, _, __, ___, ancestors) {
			// if the fragment is not a list operation, we don't care about it now
			if (!config.isListFragment(node.name.value)) {
				return
			}

			// if this is the first time we've seen this path give us a home
			const path = ancestorKey(ancestors)
			if (!pathOperations[path]) {
				pathOperations[path] = AST.arrayExpression([])
			}

			// add the operation object to the list
			pathOperations[path].elements.push(
				operationObject({
					config,
					listName: config.listNameFromFragment(node.name.value),
					operationKind: config.listOperationFromFragment(node.name.value),
					info: operationInfo(config, node),
					type: parentTypeFromAncestors(config.schema, ancestors).name,
					filterTypes,
				})
			)
		},
		Directive(node, _, __, ___, ancestors) {
			// we only care about delete directives
			if (!config.isDeleteDirective(node.name.value)) {
				return
			}

			// if this is the first time we've seen this path give us a home
			const path = ancestorKey(ancestors)
			if (!pathOperations[path]) {
				pathOperations[path] = AST.arrayExpression([])
			}

			// add the operation object to the list
			pathOperations[path].elements.push(
				operationObject({
					config,
					listName: node.name.value,
					operationKind: 'delete',
					info: operationInfo(
						config,
						ancestors[ancestors.length - 1] as graphql.FieldNode
					),
					type: config.listNameFromDirective(node.name.value),
					filterTypes,
				})
			)
		},
	})

	return pathOperations
}

function operationObject({
	config,
	listName,
	operationKind,
	info,
	type,
	filterTypes,
}: {
	config: Config
	listName: string
	operationKind: string
	info: OperationInfo
	type: string
	filterTypes: FilterMap
}) {
	const operation = AST.objectExpression([
		AST.objectProperty(AST.literal('action'), AST.stringLiteral(operationKind)),
	])

	// delete doesn't have a target
	if (operationKind !== 'delete') {
		operation.properties.push(
			AST.objectProperty(AST.literal('list'), AST.stringLiteral(listName))
		)
	}

	// add the target type to delete operations
	if (operationKind === 'delete' && type) {
		operation.properties.push(AST.objectProperty(AST.literal('type'), AST.stringLiteral(type)))
	}

	// only add the position argument if we are inserting something
	if (operationKind === 'insert') {
		operation.properties.push(
			AST.objectProperty(AST.literal('position'), AST.stringLiteral(info.position || 'last'))
		)
	}

	// if there is a parent id
	if (info.parentID) {
		// add it to the object
		operation.properties.push(
			AST.objectProperty(
				AST.literal('parentID'),
				AST.objectExpression([
					AST.objectProperty(AST.literal('kind'), AST.stringLiteral(info.parentID.kind)),
					AST.objectProperty(
						AST.literal('value'),
						AST.stringLiteral(info.parentID.value)
					),
				])
			)
		)
	}

	// if there is a conditional
	if (info.when) {
		// build up the when object
		const when = AST.objectExpression([])

		// if there is a must
		if (info.when.must) {
			when.properties.push(
				AST.objectProperty(
					AST.literal('must'),
					filterAST(filterTypes, listName, info.when.must)
				)
			)
		}

		// if there is a must_not
		if (info.when.must_not) {
			when.properties.push(
				AST.objectProperty(
					AST.literal('must_not'),
					filterAST(filterTypes, listName, info.when.must_not)
				)
			)
		}

		// add it to the object
		operation.properties.push(AST.objectProperty(AST.literal('when'), when))
	}

	return operation
}

type OperationInfo = {
	position: string
	parentID?: {
		value: string
		kind: string
	}
	when?: ListWhen
}

function operationInfo(config: Config, selection: graphql.SelectionNode): OperationInfo {
	// look at the directives applies to the spread for meta data about the mutation
	let parentID
	let parentKind: 'Variable' | 'String' = 'String'

	let position: MutationOperation['position'] = 'last'
	let operationWhen: MutationOperation['when'] | undefined

	const internalDirectives = selection.directives?.filter((directive) =>
		config.isInternalDirective(directive)
	)
	if (internalDirectives && internalDirectives.length > 0) {
		// is prepend applied?
		const prepend = internalDirectives.find(
			({ name }) => name.value === config.listPrependDirective
		)
		// is append applied?
		const append = internalDirectives.find(
			({ name }) => name.value === config.listAppendDirective
		)
		// is when applied?
		const when = internalDirectives.find(({ name }) => name.value === 'when')
		// is when_not applied?
		const when_not = internalDirectives.find(({ name }) => name.value === 'when_not')
		// look for the parentID directive
		let parent = internalDirectives.find(
			({ name }) => name.value === config.listParentDirective
		)

		// if both are applied, there's a problem
		if (append && prepend) {
			throw new Error('WRAP THIS IN A HOUDINI ERROR. you have both applied')
		}
		position = prepend ? 'first' : 'last'

		// the parent ID can be provided a few ways, either as an argument to the prepend
		// and append directives or with the parentID directive.

		let parentIDArg = parent?.arguments?.find((argument) => argument.name.value === 'value')
		// if there is no parent id argument, it could have been provided by one of the list directives
		if (!parentIDArg) {
			parentIDArg = (append || prepend)?.arguments?.find(
				({ name }) => name.value === config.listDirectiveParentIDArg
			)
		}

		if (parentIDArg) {
			// if the argument is a string
			if (parentIDArg.value.kind === 'StringValue') {
				// use its value
				parentID = parentIDArg.value.value
				parentKind = 'String'
			} else if (parentIDArg.value.kind === 'Variable') {
				parentKind = 'Variable'
				parentID = parentIDArg.value.name.value
			}
		}

		// look for a when arguments on the operation directives
		const whenArg = (append || prepend)?.arguments?.find(({ name }) => name.value === 'when')
		// look for a when_not condition on the operation
		const whenNotArg = (append || prepend)?.arguments?.find(
			({ name }) => name.value === 'when_not'
		)

		for (const [i, arg] of [whenArg, whenNotArg].entries()) {
			// we may not have the argument
			if (!arg || arg.value.kind !== 'ObjectValue') {
				continue
			}

			// which are we looking at
			const which = i ? 'must_not' : 'must'
			// build up all of the values into a single object
			const key = arg.value.fields.find(({ name, value }) => name.value === 'argument')?.value
			const value = arg.value.fields.find(({ name }) => name.value === 'value')

			// make sure we got a string for the key
			if (key?.kind !== 'StringValue' || !value || value.value.kind !== 'StringValue') {
				throw new Error('Key and Value must be strings')
			}

			// make sure we have a place to record the when condition
			if (!operationWhen) {
				operationWhen = {}
			}

			// the kind of `value` is always going to be a string because the directive
			// can only take one type as its argument so we'll worry about parsing when
			// generating the artifact
			operationWhen[which] = {
				[key.value]: value.value.value,
			}
		}

		// look at the when and when_not directives
		for (const [i, directive] of [when, when_not].entries()) {
			// we may not have the directive applied
			if (!directive) {
				continue
			}
			// which are we looking at
			const which = i ? 'must_not' : 'must'

			// look for the argument field
			const key = directive.arguments?.find(({ name }) => name.value === 'argument')
			const value = directive.arguments?.find(({ name }) => name.value === 'value')

			// make sure we got a string for the key
			if (key?.value.kind !== 'StringValue' || !value || value.value.kind !== 'StringValue') {
				throw new Error('Key and Value must be strings')
			}

			// make sure we have a place to record the when condition
			if (!operationWhen) {
				operationWhen = {}
			}

			// the kind of `value` is always going to be a string because the directive
			// can only take one type as its argument so we'll worry about parsing when
			// generating the patches
			operationWhen[which] = {
				[key.value.value]: value.value.value,
			}
		}
	}

	return {
		parentID: parentID
			? {
					value: parentID,
					kind: parentKind,
			  }
			: undefined,
		position,
		when: operationWhen,
	}
}

function filterAST(
	filterTypes: FilterMap,
	listName: string,
	filter: ListWhen['must']
): namedTypes.ObjectExpression {
	if (!filter) {
		return AST.objectExpression([])
	}

	// build up the object
	return AST.objectExpression(
		Object.entries(filter).map(([key, value]) => {
			// look up the key in the type map
			const type = filterTypes[listName] && filterTypes[listName][key]
			if (!type) {
				throw new Error(`It looks like "${key}" is an invalid filter for list ${listName}`)
			}

			let literal
			if (type === 'String') {
				literal = AST.stringLiteral(value as string)
			} else if (type === 'Boolean') {
				literal = AST.booleanLiteral(value === 'true')
			} else if (type === 'Float') {
				literal = AST.numericLiteral(parseFloat(value as string))
			} else if (type === 'Int') {
				literal = AST.numericLiteral(parseInt(value as string, 10))
			} else {
				throw new Error('Could not figure out filter value with type: ' + type)
			}
			return AST.objectProperty(AST.literal(key), literal)
		})
	)
}

// TODO: find a way to reference the actual type for ancestors, using any as escape hatch
function ancestorKey(ancestors: any): string {
	return (
		ancestors
			.filter(
				// @ts-ignore
				(entry) => !Array.isArray(entry) && entry.kind === 'Field'
			)
			// @ts-ignore
			.map((field) => field.name.value)
			.join(',')
	)
}

export type FilterMap = {
	[listName: string]: {
		[filterName: string]: 'String' | 'Float' | 'Int' | 'Boolean'
	}
}
