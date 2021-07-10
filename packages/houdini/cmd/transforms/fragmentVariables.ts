// externals
import { Config } from 'houdini-common'
import * as graphql from 'graphql'
// locals
import { CollectedGraphQLDocument } from '../types'
import { collectFragments, FragmentDependency } from './composeQueries'
import { murmurHash } from '../utils'

const GraphqlKinds = graphql.Kind

// fragmentVariables transforms fragment spreads with variables into something the server can use
export default async function fragmentVariables(
	config: Config,
	documents: CollectedGraphQLDocument[]
): Promise<void> {
	// collect all of the defined fragments
	const fragments = collectFragments(config, documents)

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

		// an operation defines a root scope that maps variable names to a value node
		// pointing to an argument with the same name
		const rootScope =
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

		// inline any fragment arguments in the document
		doc.document = inlineFragmentArgs({
			config,
			fragmentDefinitions: fragments,
			document: doc.document,
			generatedFragments,
			visitedFragments,
			scope: rootScope,
		})
	}

	// once we've handled every fragment in every document we need to add any
	// new fragment definitions to the list of collected docs so they can be picked up
	const doc: graphql.DocumentNode = {
		kind: 'Document',
		definitions: Object.values(generatedFragments),
	}

	documents.push({
		name: 'generated::fragmentVariables',
		document: doc,
		originalDocument: doc,
		generated: true,
		filename: '__generated__',
	})
}

type ValueMap = Record<string, graphql.ValueNode>

function inlineFragmentArgs({
	config,
	fragmentDefinitions,
	document,
	generatedFragments,
	visitedFragments,
	scope,
	newName,
}: {
	config: Config
	fragmentDefinitions: Record<string, FragmentDependency>
	document: graphql.ASTNode
	generatedFragments: Record<string, graphql.FragmentDefinitionNode>
	visitedFragments: Set<string>
	scope: ValueMap | undefined | null
	newName?: string
}): any {
	// look up the arguments for the fragment
	const definitionArgs = fragmentArguments(
		config,
		document as graphql.FragmentDefinitionNode
	).reduce<Record<string, FragmentArgument>>((acc, arg) => ({ ...acc, [arg.name]: arg }), {})

	const result = graphql.visit(document, {
		Argument(node) {
			// look at the arguments value to see if its a variable
			const value = node.value
			if (value.kind !== 'Variable') {
				return
			}

			// if there's no scope we can't evaluate it
			if (!scope) {
				throw new Error(
					node.name.value +
						' is not defined in the current scope: ' +
						JSON.stringify(scope)
				)
			}

			// is the variable in scope
			const newValue = scope[value.name.value]
			// if it is just use it
			if (newValue) {
				return {
					...node,
					value: newValue,
				}
			}
			// if the argument is required
			if (definitionArgs[value.name.value].required) {
				throw new Error('Missing value for required arg: ' + value.name.value)
			}

			// if we got this far, theres no value for a non-required arg, remove the node
			return null
		},
		FragmentSpread(node) {
			// look at the fragment spread to see if there are any default arguments
			// that haven't been overridden by with
			const { definition } = fragmentDefinitions[node.name.value]
			// we have to apply arguments to the fragment definitions
			let { args, hash } = collectWithArguments(config, node, scope)

			// generate a fragment name based on the arguments passed
			const newFragmentName = `${node.name.value}${hash}`

			// if we haven't handled the referenced fragment
			if (!visitedFragments.has(newFragmentName)) {
				// we need to walk down the referenced fragment definition
				visitedFragments.add(newFragmentName)

				// figure out the default arguments for the fragment
				const defaultArguments = collectDefaultArgumentValues(config, definition)

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

					// remove the element from the list
					const localDefinitions = [...doc.document.definitions]
					localDefinitions.splice(definitionIndex, 1)
					localDefinitions.push(
						inlineFragmentArgs({
							config,
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
			}
		},
	})

	// if we are supposed to change the name
	if (newName) {
		// the new name for the document
		result.name = {
			kind: 'Name',
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
	return withDirectives.flatMap((directive) => directive.arguments || [])
}

export type FragmentArgument = {
	name: string
	type: string
	required: boolean
	defaultValue: graphql.ValueNode | null
}

export function fragmentArguments(
	config: Config,
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
					throw new Error('values of @argument must be objects')
				}

				// look for the type field
				const typeArg = arg.value.fields?.find((arg) => arg.name.value === 'type')?.value
				// if theres no type arg, ignore it
				if (!typeArg || typeArg.kind !== 'StringValue') {
					return []
				}

				let type = typeArg.value
				let name = arg.name.value
				let required = false
				let defaultValue =
					arg.value.fields?.find((arg) => arg.name.value === 'default')?.value || null

				// if the name of the type ends in a ! we need to mark it as required
				if (type[type.length - 1] === '!') {
					type = type.slice(0, -1)
					required = true
					// there is no default value for a required argument
					defaultValue = null
				}

				return [
					{
						name,
						type,
						required,
						defaultValue,
					},
				]
			}) || []
	)
}

function collectDefaultArgumentValues(
	config: Config,
	definition: graphql.FragmentDefinitionNode
): ValueMap | null {
	let result: ValueMap = {}
	for (const { name, required, defaultValue } of fragmentArguments(config, definition)) {
		// if the argument is required, there's no default value
		if (required || !defaultValue) {
			continue
		}

		result[name] = defaultValue
	}

	return result
}

function collectWithArguments(
	config: Config,
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
				throw new Error('Encountered undefined variable: ' + value.name.value)
			}

			// use the value pulled from scope
			value = scope[value.name.value]
		}

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
