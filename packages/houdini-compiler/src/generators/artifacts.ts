// externals
import { Config } from 'houdini-common'
import * as graphql from 'graphql'
import { CompiledQueryKind, CompiledFragmentKind, CompiledMutationKind } from '../types'
import * as recast from 'recast'
import { ExpressionKind } from 'ast-types/gen/kinds'
import fs from 'fs/promises'
// locals
import { CollectedGraphQLDocument } from '../types'

const AST = recast.types.builders

// the artifact generator creates files in the runtime directory for each
// document containing meta data that the preprocessor might use
export default async function artifactGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	await Promise.all(
		docs.map(async ({ document, name }) => {
			// build up the query string
			const rawString = graphql.print(document)

			// figure out the document kind
			let docKind = ''

			// look for the operation
			const operations = document.definitions.filter(
				({ kind }) => kind === graphql.Kind.OPERATION_DEFINITION
			)
			// there are no operations, so its a fragment
			const fragments = document.definitions.filter(
				({ kind }) => kind === graphql.Kind.FRAGMENT_DEFINITION
			)
			// if there are operations in the document
			if (operations.length > 0) {
				// if there is more than one operation, throw an error
				if (operations.length > 1) {
					throw new Error('Operation documents can only have one operation')
				}

				if (
					operations[0].kind === graphql.Kind.OPERATION_DEFINITION &&
					operations[0].operation === 'query'
				) {
					docKind = CompiledQueryKind
				} else {
					docKind = CompiledMutationKind
				}
			}
			// if there are operations in the document
			else if (fragments.length > 0) {
				// if there is more than one operation, throw an error
				if (fragments.length > 1) {
					throw new Error('Fsragment documents can only have one fragment')
				}

				docKind = CompiledFragmentKind
			}

			// if we couldn't figure out the kind
			if (!docKind) {
				throw new Error('Could not figure out what kind of document we were given')
			}

			// start building up the artifact
			const artifact = AST.program([
				moduleExport('name', AST.stringLiteral(name || 'NO_NAME')),
				moduleExport('kind', AST.stringLiteral(docKind)),
				moduleExport(
					'raw',
					AST.templateLiteral(
						[AST.templateElement({ raw: rawString, cooked: rawString }, true)],
						[]
					)
				),
			])

			// write the result to the artifact path we're configured to write to
			await fs.writeFile(config.artifactPath(document), recast.print(artifact).code)

			// log the file location to confirm
			if (!config.quiet) {
				console.log(name)
			}
		})
	)
}

function moduleExport(key: string, value: ExpressionKind) {
	return AST.expressionStatement(
		AST.assignmentExpression(
			'=',
			AST.memberExpression(
				AST.memberExpression(AST.identifier('module'), AST.identifier('exports')),
				AST.identifier(key)
			),
			value
		)
	)
}
