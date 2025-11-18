import type {
	CallExpressionKind,
	TaggedTemplateExpressionKind,
	TSPropertySignatureKind,
} from 'ast-types/lib/gen/kinds'
import type { BaseNode } from 'estree-walker'
import { asyncWalk } from 'estree-walker'
import * as graphql from 'graphql'

import type { Config } from './config.js'
import type { CompiledDocumentKind } from './types.js'
import {
	CompiledFragmentKind,
	CompiledMutationKind,
	CompiledQueryKind,
	CompiledSubscriptionKind,
	Script,
} from './types.js'

export type EmbeddedGraphqlDocument = {
	parsedDocument: graphql.DocumentNode
	artifact: {
		name: string
		kind: CompiledDocumentKind
	}
	node: BaseNode & {
		remove: () => void
		replaceWith: (node: BaseNode) => void
	}
	tagContent: string
	parent: BaseNode
}

type GraphqlTagWalker = {
	skipGraphqlType?: boolean
	where?: (tag: graphql.DocumentNode, ast: { node: BaseNode; parent: BaseNode }) => boolean
	dependency?: (fp: string) => void
	tag: (tag: EmbeddedGraphqlDocument) => void | Promise<void>
}

// yield the tagged graphql documents contained within the provided AST
export async function find_graphql(
	config: Config,
	parsedScript: Script,
	walker: GraphqlTagWalker
): Promise<void> {
	await asyncWalk(parsedScript, {
		async enter(node, parent) {
			// graphql documents come in a few forms:
			// - graphql template tags
			// - strings passed to graphql function
			if (
				node.type !== 'TaggedTemplateExpression' &&
				node.type !== 'CallExpression' &&
				node.type !== 'TSPropertySignature' &&
				node.type !== 'VariableDeclaration'
			) {
				return
			}

			let documentString: string = ''
			let propName: string = ''

			// process template tags
			if (node.type === 'TaggedTemplateExpression') {
				// grab the string passed to the template tag as the document
				const expr = node as TaggedTemplateExpressionKind

				// we only care about graphql template tags
				if (expr.tag.type !== 'Identifier' || expr.tag.name !== 'graphql') {
					return
				}

				documentString = expr.quasi.quasis[0].value.raw
			}
			// process function calls
			else if (node.type === 'CallExpression') {
				const expr = node as CallExpressionKind
				// if the function is not called graphql, ignore it
				if (
					expr.callee.type !== 'Identifier' ||
					expr.callee.name !== 'graphql' ||
					expr.arguments.length !== 1
				) {
					return
				}
				const argument = expr.arguments[0]

				// if we have a template or string literal, use its value
				if (argument.type === 'TemplateLiteral') {
					documentString = argument.quasis[0].value.raw
				} else if (argument.type === 'StringLiteral') {
					documentString = argument.value
				} else {
					return
				}
			} else if (node.type === 'TSPropertySignature' && !walker.skipGraphqlType) {
				const signature = node as TSPropertySignatureKind
				// we only care about properties whose type is the graphql template
				if (signature.typeAnnotation?.typeAnnotation?.type !== 'TSTypeReference') {
					return
				}

				// grab the actual type annotation
				const annotation = signature.typeAnnotation?.typeAnnotation
				if (annotation.typeName.type !== 'Identifier') {
					return
				}

				// we only want references to `GraphQL`
				if (annotation.typeName.name !== 'GraphQL') {
					return
				}

				if (annotation.typeParameters?.params[0].type !== 'TSLiteralType') {
					return
				}

				const literal = annotation.typeParameters?.params[0]

				// if we have a raw string or template literal, use its value
				if (literal.literal.type === 'StringLiteral') {
					documentString = literal.literal.value
				} else if (literal.literal.type === 'TemplateLiteral') {
					documentString = literal.literal.quasis[0].value.raw
				}

				if (signature.key.type === 'Identifier') {
					propName = signature.key.name
				}
			} else if (!documentString) {
				return
			}

			// if we got this far, {documentString} holds the query
			const parsedTag = graphql.parse(documentString)

			// if there is a predicate and the graphql tag does not satisfy it
			if (walker.where && !walker.where(parsedTag, { node, parent })) {
				// ignore the tag
				return
			}

			// there are two kinds of things we could run into: operation definitions and
			// fragment definitions. In most cases, we require a name for the definition.
			// but if we run into an anonymous query, it might define a component query
			// in which care we don't want to require a name
			let anonOkay = false

			// pull out the name of the thing
			let definitions = [
				{ raw: documentString, parsed: extractDefinition(parsedTag) },
			] as ExtractedDefinition[]
			const name = definitions[0].parsed.name?.value
			let kind: CompiledDocumentKind
			if (definitions[0].parsed.kind === 'FragmentDefinition') {
				kind = CompiledFragmentKind
			} else {
				if (definitions[0].parsed.operation === 'query') {
					kind = CompiledQueryKind
				} else if (definitions[0].parsed.operation === 'mutation') {
					kind = CompiledMutationKind
				} else {
					kind = CompiledSubscriptionKind
				}
			}

			// build up the list of documents in this file

			// if we are looking at a query and it doesn't have a name
			// each of its children must be an inline fragment tagged with
			// the component query directive. Each of them should be treated
			// as their own fragment definition
			if (kind === CompiledQueryKind) {
				anonOkay = definitions[0].parsed.selectionSet.selections.every(
					(selection) =>
						selection.kind === 'InlineFragment' &&
						selection.directives?.find(
							(directive) => directive.name.value === 'componentField'
						)
				)

				if (name) {
					definitions = [{ parsed: definitions[0].parsed, raw: definitions[0].raw }]
				}
			}

			if (!name && !anonOkay) {
				throw new Error('Could not find definition name')
			}

			// tell the walk there was a dependency
			walker.dependency?.(config.artifactPath(parsedTag))

			// loop over every definition that we ran into
			for (const definition of definitions) {
				const name = definition.parsed.name?.value
				if (!name) {
					continue
				}

				// invoker the walker's callback with the right context
				await walker.tag({
					parsedDocument: {
						kind: graphql.Kind.DOCUMENT,
						definitions: [definition.parsed],
					},
					node: {
						...node,
						...this,
						remove: this.remove,
						replaceWith: this.replace,
					},
					artifact: {
						name,
						kind,
					},
					parent,
					tagContent: definition.raw,
				})
			}
		},
	})
}

type ExtractedDefinition = {
	prop?: string
	raw: string
	parsed: graphql.OperationDefinitionNode | graphql.FragmentDefinitionNode
}

export function extractDefinition(
	document: graphql.DocumentNode
): graphql.ExecutableDefinitionNode {
	// make sure there's only one definition
	if (document.definitions.length !== 1) {
		throw new Error('Encountered document with multiple definitions')
	}

	// get the definition
	const definition = document.definitions[0]

	// make sure that it's an operation definition or a fragment definition
	if (definition.kind !== 'OperationDefinition' && definition.kind !== 'FragmentDefinition') {
		throw new Error('Encountered document without a fragment or operation definition')
	}

	return definition
}
