import type { TaggedTemplateExpressionKind, IdentifierKind } from 'ast-types/gen/kinds'
import { asyncWalk, BaseNode } from 'estree-walker'
import * as graphql from 'graphql'

import {
	CompiledDocumentKind,
	CompiledFragmentKind,
	CompiledMutationKind,
	CompiledQueryKind,
	CompiledSubscriptionKind,
} from '../runtime/lib/types'
import { Config } from './config'
import { Script } from './types'

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
	where?: (tag: graphql.DocumentNode) => boolean
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
			// if we are looking at the graphql template tag
			if (
				node.type === 'TaggedTemplateExpression' &&
				((node as TaggedTemplateExpressionKind).tag as IdentifierKind).name === 'graphql'
			) {
				const expr = node as TaggedTemplateExpressionKind
				// we're going to replace the tag with something the runtime can use

				// first, lets parse the tag contents to get the info we need
				const tagContent = expr.quasi.quasis[0].value.raw
				const parsedTag = graphql.parse(tagContent)

				// if there is a predicate and the graphql tag does not satisfy it
				if (walker.where && !walker.where(parsedTag)) {
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
					tagContent,
				})
			}
		},
	})
}
