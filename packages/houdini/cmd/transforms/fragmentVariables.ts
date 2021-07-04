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
			rootScope
		)
	}

	// once we've inline every fragment in every document add their definitions to the set of collected documents
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
	scope: ValueMap,
	newName?: string
): any {
	const result = graphql.visit(document, {
		Variable(node) {
			// look up the variable in the scope
			const newValue = scope[node.name.value]

			// if we don't have a new value, it's a unknown variable
			if (!newValue) {
				throw new Error(node.name.value + ' is not defined')
			}

			return newValue
		},
		FragmentSpread(node) {
			// does the fragment spread have the with directive
			const withDirectives = node.directives?.filter(
				(directive) => directive.name.value === config.withDirective
			)

			// if not, we just leave the reference how it is. even if it has arguments,
			// we will leave behind a version with the default values in place
			if (!withDirectives || withDirectives?.length === 0) {
				return
			}

			// we have to apply arguments to the fragment definitions
			const { args, hash } = collectWithArguments(withDirectives, scope)

			// generate a fragment name based on the arguments passed
			const newFragmentName = `${node.name.value}_${hash}`

			// if we haven't seen this fragment before, go define it
			if (!generatedFragments[newFragmentName]) {
				generatedFragments[newFragmentName] = inlineFragmentArgs(
					config,
					fragmentDefinitions,
					fragmentDefinitions[node.name.value].definition,
					generatedFragments,
					args,
					newFragmentName
				)
			}

			// replace the fragment spread with one that references the generated fragment
			return {
				...node,
				name: {
					kind: 'Name',
					value: newFragmentName,
				},
			} as graphql.FragmentSpreadNode
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
function collectWithArguments(
	withDirectives: graphql.DirectiveNode[],
	scope: ValueMap
): { args: ValueMap; hash: string } {
	// build up the argument object to apply
	const args: ValueMap = {}
	const argsToHash: { [key: string]: { value: any; kind: string } } = scope
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

	return { args, hash: murmurHash(JSON.stringify(argsToHash)) }
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
