// externals
import * as graphql from 'graphql'
import * as recast from 'recast'
// locals
import { Config, ensureImports, ensureStoreImport, ensureArtifactImport } from '../../common'
import { walkTaggedDocuments } from '../utils'
import { TransformDocument } from '../types'

const AST = recast.types.builders

// returns the expression that should replace the graphql
export default async function fragmentProcessor(
	config: Config,
	doc: TransformDocument
): Promise<void> {
	// we need to find any graphql documents in the instance script containing fragments
	// and replace them with an object expression that has the keys that the runtime expects

	// if there is no instance script, we don't about care this file
	if (!doc.instance) {
		return
	}

	let proxyIdentifier:
		| [recast.types.namedTypes.Identifier, recast.types.namedTypes.Identifier]
		| null = null

	// go to every graphql document
	await walkTaggedDocuments(config, doc, doc.instance.content, {
		// with only one definition defining a fragment
		// note: the tags that satisfy this predicate will be added to the watch list
		where(tag: graphql.DocumentNode) {
			return (
				tag.definitions.length === 1 &&
				tag.definitions[0].kind === graphql.Kind.FRAGMENT_DEFINITION
			)
		},
		// if we found a tag we want to replace it with an object that the runtime can use
		async onTag({ artifact, node, tagContent, parent }) {
			// make sure that we have imported the document proxy constructor
			ensureImports({
				config,
				body: doc.instance!.content.body,
				import: ['HoudiniDocumentProxy'],
				sourceModule: '$houdini/runtime',
			})

			// instantiate a proxy we can use to update this fragment
			proxyIdentifier = [
				AST.identifier(artifact.name + 'Proxy'),
				(parent as recast.types.namedTypes.CallExpression)
					.arguments[1] as recast.types.namedTypes.Identifier,
			]

			// // add an import to the body pointing to the artifact
			const storeID = ensureStoreImport({
				config,
				body: doc.instance!.content.body,
				artifact,
			})

			const artifactID = ensureArtifactImport({
				config,
				body: doc.instance!.content.body,
				artifact,
			})

			// instantiate a handler for the fragment
			const replacement = AST.objectExpression([
				AST.objectProperty(AST.stringLiteral('kind'), AST.stringLiteral(artifact.kind)),
				AST.objectProperty(AST.stringLiteral('store'), AST.identifier(storeID)),
				AST.objectProperty(AST.stringLiteral('artifact'), AST.identifier(artifactID)),
				AST.objectProperty(AST.literal('proxy'), proxyIdentifier![0]),
				AST.objectProperty(AST.identifier('config'), AST.identifier('houdiniConfig')),
			])

			// // if the fragment is paginated we need to add a reference to the pagination query
			// if (tagContent.includes(`@${config.paginateDirective}`)) {
			// 	// add the import to the pagination query
			// 	doc.instance!.content.body.unshift(
			// 		artifactImport(config, { name: config.paginationQueryName(artifact.name) })
			// 	)

			// 	// and a reference in the tag replacement
			// 	replacement.properties.push(
			// 		AST.objectProperty(
			// 			AST.literal('paginationArtifact'),
			// 			AST.identifier(config.paginationQueryName(artifact.name))
			// 		)
			// 	)
			// }

			node.replaceWith(replacement)
		},
	})

	// if we instantiated a proxy we need to leave down a reactive statement
	// that invokes the proxy with new information
	if (!proxyIdentifier) {
		return
	}

	// find the first non import statement
	const propInsertIndex = doc.instance.content.body.findIndex(
		(expression) => expression.type !== 'ImportDeclaration'
	)

	// instantiate the proxy we'll use for the fragment
	doc.instance.content.body.splice(
		propInsertIndex,
		0,
		// @ts-ignore: babel's ast does something weird with comments, we won't use em
		AST.variableDeclaration('let', [
			AST.variableDeclarator(
				proxyIdentifier[0],
				AST.newExpression(AST.identifier('HoudiniDocumentProxy'), [])
			),
		])
	)

	// we need to add a reactive statement so that we can update the fragment value
	// if the parent id is swapped
	doc.instance.content.body.push(
		// @ts-ignore: babel's ast does something weird with comments, we won't use em
		AST.labeledStatement(
			AST.identifier('$'),
			AST.blockStatement([
				AST.expressionStatement(
					AST.callExpression(
						AST.memberExpression(proxyIdentifier[0], AST.identifier('invoke')),
						[proxyIdentifier[1]]
					)
				),
			])
		)
	)
}
