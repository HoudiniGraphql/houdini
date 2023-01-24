import type { TaggedTemplateExpressionKind, CallExpressionKind } from 'ast-types/lib/gen/kinds'
import type { BaseNode } from 'estree-walker'
import { asyncWalk } from 'estree-walker'
import * as graphql from 'graphql'

import type { CompiledDocumentKind } from '../runtime/lib/types'
import {
	CompiledFragmentKind,
	CompiledMutationKind,
	CompiledQueryKind,
	CompiledSubscriptionKind,
} from '../runtime/lib/types'
import type { Config } from './config'
import type { Script } from './types'

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
	await asyncWalk(parsedScript!, {
		async enter(node, parent) {
			// graphql documents come in a few forms:
			// - graphql template tags
			// - strings passed to graphql function
			if (node.type !== 'TaggedTemplateExpression' && node.type !== 'CallExpression') {
				return
			}

			let documentString: string

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
			} else {
				return
			}

			// if we got this far, {documentString} holds the query
			const parsedTag = graphql.parse(documentString)

			// if there is a predicate and the graphql tag does not satisfy it
			if (walker.where && !walker.where(parsedTag, { node, parent })) {
				// ignore the tag
				return
			}

			// pull out the name of the thing
			const definition = config.extractDefinition(parsedTag) as
				| graphql.OperationDefinitionNode
				| graphql.FragmentDefinitionNode
			const name = definition.name?.value
			if (!name) {
				throw new Error('Could not find definition name')
			}
			let kind: CompiledDocumentKind
			if (definition.kind === 'FragmentDefinition') {
				kind = CompiledFragmentKind
			} else {
				if (definition.operation === 'query') {
					kind = CompiledQueryKind
				} else if (definition.operation === 'mutation') {
					kind = CompiledMutationKind
				} else {
					kind = CompiledSubscriptionKind
				}
			}

			// tell the walk there was a dependency
			walker.dependency?.(config.artifactPath(parsedTag))

			// invoker the walker's callback with the right context
			await walker.tag({
				parsedDocument: parsedTag,
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
				tagContent: documentString,
			})
		},
	})
}
