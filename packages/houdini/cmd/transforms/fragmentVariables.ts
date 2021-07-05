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
		doc.document = inlineFragmentArgs(
			config,
			fragments,
			doc.document,
			generatedFragments,
			visitedFragments,
			rootScope
		)
	}

	// once we've handled every fragment in every document we need to add any
	// new fragment definitions to the list of collected docs so they can be picked up
	if (documents.length > 0) {
		documents[0].document = {
			...documents[0].document,
			definitions: [
				...documents[0].document.definitions,
				...Object.values(generatedFragments),
			],
		}
	}
}

type ValueMap = Record<string, graphql.ValueNode>

function inlineFragmentArgs(
	config: Config,
	fragmentDefinitions: Record<string, FragmentDependency>,
	document: graphql.ASTNode,
	generatedFragments: Record<string, graphql.FragmentDefinitionNode> = {},
	visitedFragments: Set<string>,
	scope: ValueMap | undefined | null,
	newName?: string
): any {
	const result = graphql.visit(document, {
		Variable(node) {
			// if there is no scope
			if (!scope) {
				throw new Error(node.name.value + ' is not defined')
			}

			// look up the variable in the scope
			const newValue = scope[node.name.value]

			// if we don't have a new value, it's a unknown variable
			if (!newValue) {
				throw new Error(node.name.value + ' is not defined')
			}

			return newValue
		},
		FragmentSpread(node) {
			// look at the fragment spread to see if there are any default arguments
			// that haven't been overriden by with
			const { definition } = fragmentDefinitions[node.name.value]
			/// look up the default args
			const defaultArgs = collectDefaultArgumentValues(config, definition)

			// we have to apply arguments to the fragment definitions
			let { args, hash } = collectWithArguments(config, node, scope)

			// generate a fragment name based on the arguments passed
			const newFragmentName = `${node.name.value}${hash}`

			// if we haven't handled the referenced fragment
			if (!visitedFragments.has(newFragmentName)) {
				// we need to walk down the referenced fragment definition
				visitedFragments.add(newFragmentName)

				// if there are local arguments we need to treat it like a new fragment
				if (args) {
					// assign any default values to the scope
					for (const [field, value] of Object.entries(defaultArgs || {})) {
						if (!args[field]) {
							args[field] = value
						}
					}

					generatedFragments[newFragmentName] = inlineFragmentArgs(
						config,
						fragmentDefinitions,
						fragmentDefinitions[node.name.value].definition,
						generatedFragments,
						visitedFragments,
						args,
						newFragmentName
					)
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
					localDefinitions.splice(definitionIndex)
					localDefinitions.push(
						(generatedFragments[newFragmentName] = inlineFragmentArgs(
							config,
							fragmentDefinitions,
							fragmentDefinitions[node.name.value].definition,
							generatedFragments,
							visitedFragments,
							defaultArgs,
							''
						))
					)

					doc.document = {
						...doc.document,
						definitions: localDefinitions,
					}
				}

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

function collectDefaultArgumentValues(
	config: Config,
	definition: graphql.FragmentDefinitionNode
): ValueMap | null {
	const directives = definition.directives?.filter(
		(directive) => directive.name.value === config.argumentsDirective
	)

	if (!directives || directives.length === 0) {
		return null
	}

	let result: ValueMap = {}
	for (const arg of directives.flatMap((directive) => directive.arguments || [])) {
		// look up the default value key
		let argObject = arg.value as graphql.ObjectValueNode

		// if there is no default value, dont consider this argument
		const defaultValue = argObject.fields.find((field) => field.name.value === 'defaultValue')
			?.value
		if (!defaultValue) {
			continue
		}
		result[arg.name.value] = defaultValue
	}

	return result
}

function collectWithArguments(
	config: Config,
	node: graphql.FragmentSpreadNode,
	scope: ValueMap | null = {}
): { args: ValueMap | null; hash: string } {
	const withDirectives = node.directives?.filter(
		(directive) => directive.name.value === config.withDirective
	)
	if (!withDirectives || withDirectives.length === 0) {
		return { args: null, hash: '' }
	}

	// build up the argument object to apply
	let args: ValueMap | null = {}
	const argsToHash: { [key: string]: { value: any; kind: string } } | null = {}
	for (const arg of withDirectives.flatMap((directive) => directive.arguments || [])) {
		args[arg.name.value] = {
			...arg.value,
			loc: undefined,
		}
		argsToHash[arg.name.value] = {
			kind: arg.value.kind,
			value: serializeArg(arg.value),
		}
	}

	return {
		args: Object.keys(args).length > 0 ? args : null,
		hash:
			Object.keys(argsToHash || {}).length > 0
				? '_' + murmurHash(JSON.stringify(argsToHash))
				: '',
	}
}

function serializeArg(node: graphql.ValueNode): any {
	switch (node.kind) {
		case GraphqlKinds.BOOLEAN:
		case GraphqlKinds.FLOAT:
		case GraphqlKinds.INT:
		case GraphqlKinds.ENUM:
		case GraphqlKinds.STRING:
			return node.value.toString()
		case GraphqlKinds.NULL:
			return null
		case GraphqlKinds.LIST:
			return node.values.map(serializeArg)
		case GraphqlKinds.OBJECT:
			return Object.fromEntries(
				Object.entries(node.fields).map(([key, { value }]) => [key, serializeArg(value)])
			)
		case GraphqlKinds.VARIABLE:
			return node.name
	}
}
