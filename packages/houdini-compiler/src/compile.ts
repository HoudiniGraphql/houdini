// externals
import glob from 'glob'
import * as svelte from 'svelte/compiler'
import fs from 'fs/promises'
import * as graphql from 'graphql'
import { promisify } from 'util'
import { Config } from 'houdini-common'
// locals
import { CollectedGraphQLDocument } from './types'
import applyTransforms from './transforms'
import runGenerators from './generators'

// the compiler's job can be broken down into three different tasks:
// - collect all of the graphql documents defined in the project
// - perform a series of transformations on those documents
// - write the corresponding artifacts to disk
export default async function compile(config: Config) {
	// grab the graphql documents
	const documents = await collectDocuments(config)

	// now that we have the list of documents, we need to pass them through our transforms
	// to optimize their content, validate their structure, and add anything else we need behind the scenes
	await applyTransforms(config, documents)

	// delete the runtime directory we are about to create

	// write the artifacts
	await runGenerators(config, documents)
}

async function collectDocuments(config: Config): Promise<CollectedGraphQLDocument[]> {
	// the first step we have to do is grab a list of every file in the source tree
	const sourceFiles = await promisify(glob)(config.sourceGlob)

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
								// parse the tag contents to get the info we need
								const parsedDoc = graphql.parse(node.quasi.quasis[0].value.raw)

								// look for the operation
								const operations = parsedDoc.definitions.filter(
									({ kind }) => kind === graphql.Kind.OPERATION_DEFINITION
								)
								// there are no operations, so its a fragment
								const fragments = parsedDoc.definitions.filter(
									({ kind }) => kind === graphql.Kind.FRAGMENT_DEFINITION
								)
								// if there is more than one operation, throw an error
								if (operations.length > 1) {
									throw new Error(
										'Operation documents can only have one operation'
									)
								}
								// if there is more than one operation, throw an error
								if (fragments.length > 1) {
									throw new Error('Fragment documents can only have one fragment')
								}

								// add it to the list
								documents.push({
									name: config.documentName(parsedDoc),
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
