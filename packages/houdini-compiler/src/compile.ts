// externals
import glob from 'glob'
import * as svelte from 'svelte/compiler'
import fs from 'fs/promises'
import * as graphql from 'graphql'
import path from 'path'
import * as recast from 'recast'
const AST = recast.types.builders
import mkdirp from 'mkdirp'
import { ExpressionKind } from 'ast-types/gen/kinds'
import { promisify } from 'util'
// locals
import {
	HoudiniCompilerConfig,
	CollectedGraphQLDocument,
	CompiledMutationKind,
	CompiledQueryKind,
	CompiledFragmentKind,
} from './types'
import applyTransforms from './transforms'

const OperationDocumentKind = graphql.Kind.OPERATION_DEFINITION
const FragmentDocumentKind = graphql.Kind.FRAGMENT_DEFINITION

// the compiler's job can be broken down into three different tasks:
// - collect all of the graphql documents defined in the project
// - perform a series of transformations on those documents
// - write the corresponding artifacts to disk
export default async function compile(config: HoudiniCompilerConfig) {
	// make sure the artifact directory exists
	await mkdirp(config.artifactDirectory)

	// grab the graphql documents
	const documents = await collectDocuments()

	// now that we have the list of documents, we need to pass them through our transforms
	// to optimize their content, validate their structure, and add anything else we need behind the scenes
	await applyTransforms(documents)

	// write the artifacts
	await writeArtifacts(config, documents)
}

async function collectDocuments(): Promise<CollectedGraphQLDocument[]> {
	// the first step we have to do is grab a list of every file in the source tree
	const sourceFiles = await promisify(glob)('src/{routes,components}/*.svelte')

	// the list of documents we found
	const documents: CollectedGraphQLDocument[] = []

	// wait for every file to be processed
	await Promise.all(
		sourceFiles.map(async (filePath) => {
			// read the file
			const contents = await fs.readFile(filePath, 'utf-8')

			// parse the contents
			const parsedFile = svelte.parse(contents)

			// we need to look for multiple script tags to support sveltekit
			const scripts = [parsedFile.instance, parsedFile.module]

			await Promise.all(
				scripts.map(async (jsContent) => {
					// look for any template tag literals in the script body
					svelte.walk(jsContent, {
						enter(node) {
							// if we are looking at the graphql template tag
							if (
								node.type === 'TaggedTemplateExpression' &&
								// @ts-ignore
								node.tag.name === 'graphql'
							) {
								// @ts-ignore
								// first, lets parse the tag contents to get the info we need
								const rawDocument = node.quasi.quasis[0].value.raw
								const parsedDoc = graphql.parse(rawDocument)

								// make sure there is only one definition in the document
								if (parsedDoc.definitions.length > 1) {
									throw new Error('encountered multiple definitions')
								}

								// grab the top level definition
								const definition = parsedDoc.definitions[0] as
									| graphql.FragmentDefinitionNode
									| graphql.OperationDefinitionNode

								// if there is no name
								if (!definition.name) {
									throw new Error('Encountered document with no name')
								}

								// add it to the list
								documents.push({
									name: definition.name.value,
									document: parsedDoc,
								})
							}
						},
					})
				})
			)
		})
	)

	// return the list we built up
	return documents
}
function writeArtifacts(config: HoudiniCompilerConfig, documents: CollectedGraphQLDocument[]) {
	return Promise.all(
		documents.map(async ({ document, name }) => {
			// build up the query string
			const rawString = graphql.print(document)

			// the location we will put the operation artifact
			const targetLocation = path.join(config.artifactDirectory, `${name}.js`)

			// figure out the document kind
			let docKind = ''

			// look for the operation
			const operations = document.definitions.filter(
				({ kind }) => kind === OperationDocumentKind
			)
			// there are no operations, so its a fragment
			const fragments = document.definitions.filter(
				({ kind }) => kind === FragmentDocumentKind
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

			// write the result
			await fs.writeFile(targetLocation, recast.print(artifact).code)

			// log the file location to confirm
			console.log(name)
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
