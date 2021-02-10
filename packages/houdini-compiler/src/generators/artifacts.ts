// externals
import { Config, hashDocument } from 'houdini-common'
import * as graphql from 'graphql'
import { CompiledQueryKind, CompiledFragmentKind, CompiledMutationKind } from '../types'
import * as recast from 'recast'
import fs from 'fs/promises'
// locals
import { CollectedGraphQLDocument } from '../types'
import { moduleExport } from '../utils'

const AST = recast.types.builders

// the artifact generator creates files in the runtime directory for each
// document containing meta data that the preprocessor might use
export default async function artifactGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	await Promise.all(
		docs.map(async ({ document, name, printed }) => {
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
				// figure out if its a query
				if (
					operations[0].kind === graphql.Kind.OPERATION_DEFINITION &&
					operations[0].operation === 'query'
				) {
					docKind = CompiledQueryKind
				}
				// or a mutation
				else {
					docKind = CompiledMutationKind
				}
			}
			// if there are operations in the document
			else if (fragments.length > 0) {
				docKind = CompiledFragmentKind
			}

			// if we couldn't figure out the kind
			if (!docKind) {
				throw new Error('Could not figure out what kind of document we were given')
			}

			// generate a hash of the document that we can use to detect changes
			// start building up the artifact
			const artifact = AST.program([
				moduleExport('name', AST.stringLiteral(name)),
				moduleExport('kind', AST.stringLiteral(docKind)),
				moduleExport('hash', AST.stringLiteral(hashDocument(printed))),
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
