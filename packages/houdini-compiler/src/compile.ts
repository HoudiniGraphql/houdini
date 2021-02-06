// externals
import glob from 'glob'
import * as svelte from 'svelte/compiler'
import fs from 'fs/promises'
import * as graphql from 'graphql'
import path from 'path'
import * as recast from 'recast'
import mkdirp from 'mkdirp'
import { promisify } from 'util'
import { Config } from 'houdini-common'
// locals
import {
	CollectedGraphQLDocument,
	CompiledMutationKind,
	CompiledQueryKind,
	CompiledFragmentKind,
} from './types'
import applyTransforms from './transforms'
import runGenerators from './generators'

// the compiler's job can be broken down into three different tasks:
// - collect all of the graphql documents defined in the project
// - perform a series of transformations on those documents
// - write the corresponding artifacts to disk
export default async function compile(config: Config) {
	// make sure the artifact directory exists
	await mkdirp(config.artifactDirectory)

	// grab the graphql documents
	const documents = await collectDocuments()

	// now that we have the list of documents, we need to pass them through our transforms
	// to optimize their content, validate their structure, and add anything else we need behind the scenes
	await applyTransforms(config, documents)

	// write the artifacts
	await runGenerators(config, documents)
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
