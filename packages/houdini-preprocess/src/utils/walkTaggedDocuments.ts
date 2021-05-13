// externals
import * as graphql from 'graphql'
import { asyncWalk } from 'estree-walker'
import { TaggedTemplateExpressionKind, IdentifierKind } from 'ast-types/gen/kinds'
import { BaseNode } from 'estree'
import { Program } from '@babel/types'
import {
	CompiledDocumentKind,
	CompiledFragmentKind,
	CompiledMutationKind,
	CompiledQueryKind,
	CompiledSubscriptionKind,
} from 'houdini'
import { Config } from 'houdini-common'
// locals
import { TransformDocument } from '../types.js'

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
	parent: BaseNode
}

type GraphqlTagWalker = {
	where?: (tag: graphql.DocumentNode) => boolean
	onTag: (tag: EmbeddedGraphqlDocument) => void | Promise<void>
}

// yield the tagged graphql documents contained within the provided AST
export default async function walkTaggedDocuments(
	config: Config,
	doc: TransformDocument,
	parsedScript: Program,
	walker: GraphqlTagWalker
): Promise<void> {
	// @ts-ignore
	await asyncWalk(parsedScript, {
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

				// make sure there is only one definition
				if (parsedTag.definitions.length > 1) {
					throw new Error('Encountered multiple definitions in a tag')
				}

				// if there is a predicate and the graphql tag does not satisfy it
				if (walker.where && !walker.where(parsedTag)) {
					// ignore the tag
					return
				}

				// pull out the name of the thing
				const definition = parsedTag.definitions[0] as
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

				// the location for the document artifact
				const documentPath = doc.config.artifactPath(parsedTag)

				// make sure we watch the compiled fragment
				doc.dependencies.push(documentPath)

				// invoker the walker's callback with the right context
				await walker.onTag({
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
				})
			}
		},
	})
}
