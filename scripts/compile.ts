// externals
import glob from 'glob'
import { gqlPluckFromCodeString } from 'graphql-tag-pluck'
import * as svelte from 'svelte/compiler'
import fs from 'fs/promises'
import * as graphql from 'graphql'
import { Kind as GraphqlKinds } from 'graphql/language'

// the objects used to hold document meta data
type Document = {
	name: string
	raw: string
	parsed: graphql.DefinitionNode
	requiredFragments: Array<string>
}

// the compile script is responsible for two different things:
// - joining operations with all of the fragments that are used for a valid request
// - generating types to match the result of operations and fragments
async function main() {
	// the first step we have to do is grab a list of every file in the source tree
	const sourceFiles: string[] = glob.sync('src/**/*.svelte')

	// we need to collect all of the fragment definitions before we can do anything for operations
	const fragments: { [name: string]: Document } = {}
	const operations: { [name: string]: Document } = {}

	// wait for every file to be processed
	await Promise.all(
		sourceFiles.map(async (filePath) => {
			// read the file
			const contents = await fs.readFile(filePath, 'utf-8')
			// the javascript bits
			let jsContent

			// pretend we are preprocessing to get access to the javascript bits
			svelte.preprocess(contents, {
				script({ content }) {
					jsContent = content
					return {
						code: content,
					}
				},
			})

			// grab the graphql document listed in the file
			const document = await gqlPluckFromCodeString(jsContent, {
				modules: [
					{ name: '$houdini', identifier: 'graphql' },
					{ name: 'houdini', identifier: 'graphql' },
				],
			})

			// parse the document
			const parsedDoc = graphql.parse(document)

			// make sure there is only one definition in a document
			if (parsedDoc.definitions.length > 1) {
				throw new Error('encountered multiple definitions')
			}

			// grab the top level definition
			const definition = parsedDoc.definitions[0] as
				| graphql.FragmentDefinitionNode
				| graphql.OperationDefinitionNode

			// the document we'll register
			const doc: Document = {
				name: definition.name.value,
				raw: document,
				parsed: definition,
				requiredFragments: findRequiredFragments(definition.selectionSet),
			}

			// if we are dealing with a fragment
			if (definition.kind === GraphqlKinds.FRAGMENT_DEFINITION) {
				fragments[definition.name.value] = doc
			}
			// could have been an operation
			else if (definition.kind === GraphqlKinds.OPERATION_DEFINITION) {
				operations[definition.name.value] = doc
			}
		})
	)

	// now that we've processed every file, lets build up the artifacts that the library will use

	// every operation will need the complete query
	await Promise.all(
		Object.values(operations).map(async (operation) => {
			// fragments can be cyclic so we'll need to keep track of fragments we've already processed
			const handledFragments = new Set()

			// the total query string
			let queryString = ''
		})
	)
}

function findRequiredFragments(selectionSet: graphql.SelectionSetNode): Array<string> {
	// if there are no selections in this set
	if (selectionSet.selections.length === 0) {
		return []
	}

	// build up a list of referenced fragments in this selection
	const referencedFragments = []
	for (const selection of selectionSet.selections) {
		// if this selection is a fragment spread
		if (selection.kind === GraphqlKinds.FRAGMENT_SPREAD) {
			// add the name of the referenced fragment
			referencedFragments.push(selection.name.value)
			// if this is something with a subselection
		} else if (selection.selectionSet) {
			// add the referenced fragments in the selection
			referencedFragments.push(...findRequiredFragments(selection.selectionSet))
		}
	}

	// we're done
	return referencedFragments
}

main()
