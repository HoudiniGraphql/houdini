// externals
import * as graphql from 'graphql'
import { asyncWalk, BaseNode } from 'estree-walker'
import { TaggedTemplateExpressionKind, IdentifierKind } from 'ast-types/gen/kinds'
import * as recast from 'recast'
// locals
import { Config, ensureImports } from '../../common'
import {
	CompiledDocumentKind,
	CompiledFragmentKind,
	CompiledMutationKind,
	CompiledQueryKind,
	CompiledSubscriptionKind,
} from '../../runtime/lib/types'
import { TransformDocument } from '../types'

type Program = ReturnType<typeof recast.types.builders.statement>

const AST = recast.types.builders

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

				// if there is a query in the document, we want to add an import to the module script
				// doing it here ensures that we don't import the config since we can guarantee
				// that the import only ends up in the module script

				// make sure there is a module script
				if (!doc.module) {
					doc.module = {
						start: 0,
						end: 0,
						// @ts-ignore
						content: AST.program([]),
					}
				}
				// add the imports if they're not there
				ensureImports({
					config,
					body: doc.module!.content.body,
					import: ['houdiniConfig'],
					sourceModule: '$houdini',
				})

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
					tagContent,
				})
			}
		},
	})
}
