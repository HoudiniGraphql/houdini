import structuredClone from '@ungap/structured-clone'
import * as graphql from 'graphql'

import {
	type GraphQLValue,
	type Config,
	type Document,
	type ValueMap,
	HoudiniError,
	ArtifactKind,
} from '../../lib'
import { murmurHash } from '../utils'
import type { FragmentDependency } from './collectDefinitions'
import { collectDefinitions } from './collectDefinitions'

const GraphqlKinds = graphql.Kind

// fragmentVariables transforms fragment spreads with variables into something the server can use
export default async function fragmentVariables(
	config: Config,
	documents: Document[]
): Promise<void> {
	// collect all of the defined fragments
	const fragments = collectDefinitions(config, documents)

	// we're going to generate new fragment definitions that have the argument values
	// replaced inline. In order to pull this off, we might need to string operation
	// variables through to the fragment definitions. In order to know which variables
	// correspond to which fragment arguments, we need to start at operations and
	// walk down the entire selection set, mapping variables to arguments as we go

	// a map from generated fragment names to their definition
	const generatedFragments: Record<string, graphql.FragmentDefinitionNode> = {}
	const visitedFragments: Set<string> = new Set()

	// start with the documents containing operations
	for (const doc of documents) {
		// look for the operation in this document
		const operation = doc.document.definitions.find(
			({ kind }) => kind === GraphqlKinds.OPERATION_DEFINITION
		) as graphql.OperationDefinitionNode

		// if there isn't one we don't care about this document
		if (!operation) {
			continue
		}

		// inline any fragment arguments in the document
		doc.document = inlineFragmentArgs({
			config,
			filepath: doc.filename,
			fragmentDefinitions: fragments,
			document: doc.document,
			generatedFragments,
			visitedFragments,
			scope: null,
		})
	}

	// once we've handled every fragment in every document we need to add any
	// new fragment definitions to the list of collected docs so they can be picked up
	const doc: graphql.DocumentNode = {
		kind: graphql.Kind.DOCUMENT,
		definitions: Object.values(generatedFragments),
	}

	documents.push({
		name: 'generated::fragmentVariables',
		kind: ArtifactKind.Fragment,
		document: doc,
		originalParsed: doc,
		generateStore: false,
		generateArtifact: false,
		filename: 'generated::fragmentVariables',
		originalString: '',
		artifact: null,
	})
}

function inlineFragmentArgs({
	config,
	filepath,
	fragmentDefinitions,
	document,
	generatedFragments,
	visitedFragments,
	scope,
	newName,
}: {
	config: Config
	filepath: string
	fragmentDefinitions: Record<string, FragmentDependency>
	document: graphql.ASTNode
	generatedFragments: Record<string, graphql.FragmentDefinitionNode>
	visitedFragments: Set<string>
	scope: ValueMap | undefined | null
	newName?: string
}): any {
	// if the scope is null, use the root-level scope defined by the document's
	// operation definition
	if (!scope) {
		scope = operationScope(
			(document as graphql.DocumentNode).definitions.find(
				({ kind }) => kind === GraphqlKinds.OPERATION_DEFINITION
			) as graphql.OperationDefinitionNode
		)
	}

	// look up the arguments for the fragment
	const definitionArgs = fragmentArguments(
		config,
		filepath,
		document as graphql.FragmentDefinitionNode
	).reduce<Record<string, FragmentArgument>>((acc, arg) => ({ ...acc, [arg.name]: arg }), {})

	/**
	 * Explores a ValueNode deeply and searches for Variable Nodes.
	 * Could be the first node or any node in an ObjectValueNode.
	 * E.g. if your using deep fragment arguments:
	 * ```graphql
	 *  users(filter: {name: $name}, filter2: {data: {age: $age}})
	 * ```
	 *
	 * It replaced every VariableNode with its explicit value. If there is not argument provided,
	 * error if the argument is required or delete the node if the argument is optional.
	 *
	 * @param node any ValueNode
	 * @returns the node where all variable nodes get replaced with their explicit values. And null if the argument is optional and not set
	 */
	const modifyValue = <T extends graphql.ValueNode>(node: T): T | graphql.ValueNode | null => {
		// if the node is an ObjectValueNode explore the fields. => Checks if any field contains a variable
		if (node.kind == 'ObjectValue') {
			return {
				...node,
				fields: node.fields.map((field) => {
					// Delete the field if the argument is optional and not set in parent
					const modifiedValue = modifyValue(field.value)
					if (!modifiedValue) return null
					return {
						...field,
						value: modifyValue(field.value),
					}
				}),
			}
		}

		// if the node is not a variable node, keep it in case you explore a ObjectValueNode
		if (node.kind !== 'Variable') {
			return node
		}

		// if there's no scope we can't evaluate it
		if (!scope) {
			throw new HoudiniError({
				filepath,
				message:
					node.name.value +
					' is not defined in the current scope: ' +
					JSON.stringify(scope),
			})
		}

		// is the variable in scope
		const newValue = scope[node.name.value]

		// The value was found in scope
		if (newValue) {
			return newValue
		}

		// if the argument is required
		if (definitionArgs[node.name.value] && definitionArgs[node.name.value].required) {
			throw new HoudiniError({
				filepath,
				message: 'Missing value for required arg: ' + node.name.value,
			})
		}

		// The argument is optional and not set in parent => delete the node.
		return null
	}

	const result = structuredClone(
		graphql.visit(document, {
			// every time we run into a fragment spread we might need to replace it
			// with a version that incorporates the current scope's variable values
			FragmentSpread(node) {
				// look at the fragment spread to see if there are any default arguments
				// that haven't been overridden by with
				if (!fragmentDefinitions[node.name.value]) {
					throw new Error('Could not find definition for fragment' + node.name.value)
				}
				const { definition } = fragmentDefinitions[node.name.value]

				// we have to apply arguments to the fragment definitions
				let { args, hash } = collectWithArguments(config, filepath, node, scope)

				// generate a fragment name based on the arguments passed
				const newFragmentName = `${node.name.value}${hash}`
				config.registerFragmentVariablesHash({
					hash: newFragmentName,
					fragment: node.name.value,
					args,
				})

				// if we haven't handled the referenced fragment
				if (!visitedFragments.has(newFragmentName)) {
					// we need to walk down the referenced fragment definition
					visitedFragments.add(newFragmentName)

					// figure out the default arguments for the fragment
					const defaultArguments = collectDefaultArgumentValues(
						config,
						filepath,
						definition
					)

					// if there are local arguments we need to treat it like a new fragment
					if (args) {
						// assign any default values to the scope
						for (const [field, value] of Object.entries(defaultArguments || {})) {
							if (!args[field]) {
								args[field] = value
							}
						}

						generatedFragments[newFragmentName] = inlineFragmentArgs({
							config,
							filepath,
							fragmentDefinitions,
							document: fragmentDefinitions[node.name.value].definition,
							generatedFragments,
							visitedFragments,
							scope: args,
							newName: newFragmentName,
						})
					}
					// there are no local arguments to the fragment so we need to
					// walk down the definition and apply any default args as well
					// as look for internal fragment spreads for the referenced fragment
					else {
						// the document holding the fragment definition
						const doc = fragmentDefinitions[node.name.value].document

						// find the fragment definition in the document
						const definitionIndex = doc.document.definitions.findIndex(
							(definition) =>
								definition.kind === 'FragmentDefinition' &&
								definition.name.value === node.name.value
						)

						const localDefinitions = [...doc.document.definitions]
						localDefinitions.splice(definitionIndex, 1)
						localDefinitions.push(
							// keep walking down the referenced fragment's selection
							// and replace the definition in the document
							inlineFragmentArgs({
								config,
								filepath,
								fragmentDefinitions,
								document: fragmentDefinitions[node.name.value].definition,
								generatedFragments,
								visitedFragments,
								scope: defaultArguments,
								newName: '',
							})
						)

						doc.document = {
							...doc.document,
							definitions: localDefinitions,
						}
					}
				}

				// if we changed the name of the fragment
				if (node.name.value !== newFragmentName) {
					// replace the fragment spread with one that references the generated fragment
					return {
						...node,
						name: {
							kind: 'Name',
							value: newFragmentName,
						},
					} as graphql.FragmentSpreadNode
				}
			},
			// look at every time something is used as an argument
			Argument(node) {
				let value = node.value

				// Explore the node deeply and check for Variable nodes.
				// Replace any variable node the the explicit value
				const newValue = modifyValue(value)

				// Replace the value. Will only be null if node is a VariableNode
				// and no arguments are provided for an optional argument.
				if (newValue) {
					return {
						...node,
						value: newValue,
					}
				}

				// if we got this far, theres no value for a non-required arg, remove the node
				return null
			},
		})
	)

	// if we computed a new name for the fragment (because we got here as part of analyzing a fragment
	// spread with @with), we need to change the name of the fragment
	if (newName) {
		// @ts-ignore
		// the new name for the document
		result.name = {
			kind: graphql.Kind.NAME,
			value: newName,
		}
	}

	return result
}

export function withArguments(
	config: Config,
	node: graphql.FragmentSpreadNode
): graphql.ArgumentNode[] {
	const withDirectives = node.directives?.filter(
		(directive) => directive.name.value === config.withDirective
	)
	if (!withDirectives || withDirectives.length === 0) {
		return []
	}

	// flatten all of the arguments passed to every @with
	return withDirectives.flatMap((directive) => removeLocKey(directive.arguments) || [])
}

function removeLocKey<
	T extends GraphQLValue | readonly graphql.ArgumentNode[] | graphql.ArgumentNode
>(value: T): T {
	if (typeof value !== 'object' || value === null) {
		return value
	}

	if (Array.isArray(value)) {
		// @ts-expect-error
		return value.map(removeLocKey)
	}

	// if the value is an object, remove the loc key
	return Object.fromEntries(
		Object.entries(value).map(([key, fieldValue]) => {
			if (key === 'loc') {
				return []
			}

			return [key, removeLocKey(fieldValue)]
		})
	)
}

export type FragmentArgument = {
	name: string
	type: graphql.TypeNode
	required: boolean
	defaultValue: graphql.ValueNode | null
}

export function fragmentArguments(
	config: Config,
	filepath: string,
	definition: graphql.FragmentDefinitionNode
): FragmentArgument[] {
	const directives = definition.directives?.filter(
		(directive) => directive.name.value === config.argumentsDirective
	)

	if (!directives || directives.length === 0) {
		return []
	}

	return directives.flatMap(
		(directive) =>
			// every argument to the directive specifies an argument to the fragment
			directive.arguments?.flatMap((arg) => {
				// arguments must be object
				if (arg.value.kind !== 'ObjectValue') {
					throw new HoudiniError({
						filepath,
						message: 'values of @argument must be objects',
					})
				}

				// look for the type field
				const typeArg = arg.value.fields?.find((arg) => arg.name.value === 'type')?.value
				// if theres no type arg, ignore it
				if (!typeArg || typeArg.kind !== 'StringValue') {
					return []
				}

				let type = parseArgumentTypeString(typeArg.value)
				let defaultValue =
					arg.value.fields?.find((arg) => arg.name.value === 'default')?.value || null

				return [
					{
						name: arg.name.value,
						type,
						required: type.kind === 'NonNullType',
						defaultValue,
					},
				]
			}) || []
	)
}

// parseArgumentTypeString parses strings like [String!]! and turns
// them into the corresponding graphql AST
export function parseArgumentTypeString(input: string): graphql.TypeNode {
	// because of the structure of the string, we can start at the end of the input

	// if we are dealing with a non-null
	if (input[input.length - 1] === '!') {
		const inner = parseArgumentTypeString(input.substring(0, input.length - 1))
		if (inner.kind === 'NonNullType') {
			throw new Error('invalid type' + input)
		}

		return {
			kind: 'NonNullType',
			type: inner,
		}
	}

	// if we are dealing with a list
	if (input[input.length - 1] === ']') {
		const inner = parseArgumentTypeString(input.substring(1, input.length - 1))

		return {
			kind: 'ListType',
			type: inner,
		}
	}

	// we are dealing with a name
	return {
		kind: 'NamedType',
		name: {
			kind: 'Name',
			value: input,
		},
	}
}

function collectDefaultArgumentValues(
	config: Config,
	filepath: string,
	definition: graphql.FragmentDefinitionNode
): ValueMap | null {
	let result: ValueMap = {}
	for (const { name, required, defaultValue } of fragmentArguments(
		config,
		filepath,
		definition
	)) {
		// if the argument is required, there's no default value
		if (required || !defaultValue) {
			continue
		}

		result[name] = defaultValue
	}

	return result
}

export function collectWithArguments(
	config: Config,
	filepath: string,
	node: graphql.FragmentSpreadNode,
	scope: ValueMap | null = {}
): { args: ValueMap | null; hash: string } {
	const withArgs = withArguments(config, node)
	// if there aren't any
	if (withArgs.length === 0) {
		return { args: null, hash: '' }
	}

	// build up the argument object to apply
	let args: ValueMap = {}
	for (const arg of withArgs) {
		let value = arg.value
		// if the argument is a variable, we need to look it up in score
		if (value.kind === GraphqlKinds.VARIABLE) {
			// if we don't have a scope the variable isn't defined
			if (!scope || !scope[value.name.value]) {
				throw new HoudiniError({
					filepath,
					message: 'Encountered undefined variable: ' + value.name.value,
				})
			}

			// use the value pulled from scope
			value = scope[value.name.value]
		}

		// @ts-ignore
		value.loc = undefined

		args[arg.name.value] = {
			...value,
			loc: undefined,
		}
	}

	// return the args and the corresponding hash
	return {
		args,
		hash: '_' + murmurHash(JSON.stringify(args)),
	}
}

function operationScope(operation: graphql.OperationDefinitionNode) {
	return (
		operation.variableDefinitions?.reduce<ValueMap>(
			(scope, definition) => ({
				...scope,
				[definition.variable.name.value]: {
					kind: 'Variable',
					name: {
						kind: 'Name',
						value: definition.variable.name.value,
					},
				} as graphql.VariableNode,
			}),
			{}
		) || {}
	)
}

export function fragmentArgumentsDefinitions(
	config: Config,
	filepath: string,
	definition: graphql.FragmentDefinitionNode
): graphql.VariableDefinitionNode[] {
	// analyze the @artguments directive
	const args = fragmentArguments(config, filepath, definition)
	if (args.length === 0) {
		return []
	}

	// we have a list of the arguments
	return args.map<graphql.VariableDefinitionNode>((arg) => {
		return {
			kind: 'VariableDefinition',
			type: arg.type,
			variable: {
				kind: 'Variable',
				name: {
					kind: 'Name',
					value: arg.name,
				},
			},
			defaultValue: arg.defaultValue ?? undefined,
		}
	})
}
