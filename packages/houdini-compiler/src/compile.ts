// externals
import glob from 'glob'
import * as svelte from 'svelte/compiler'
import fs from 'fs/promises'
import * as graphql from 'graphql'
import { Kind as GraphqlKinds } from 'graphql/language'
import path from 'path'
import * as recast from 'recast'
const AST = recast.types.builders
import mkdirp from 'mkdirp'
import { StatementKind } from 'ast-types/gen/kinds'

// the objects used to hold document meta data

type FirstPassDocument = {
	name: string
	raw: string
	parsed: graphql.FragmentDefinitionNode | graphql.OperationDefinitionNode
	kind:
		| import('graphql/language').OperationDefinitionNode['kind']
		| import('graphql/language').FragmentDefinitionNode['kind']
}

export type Document = {
	requiredFragments: Array<string>
} & FirstPassDocument

type Config = {
	artifactDirectory: string
}

const defaultConfig: Config = {
	artifactDirectory: path.join(__dirname, '..', '..', '..', 'example', 'generated'),
}

// the compile script is responsible for two different things:
// - joining operations with all of the fragments that are used for a valid request
// - generating types to match the result of operations and fragments
//
export default async function compile(config: Config = defaultConfig) {
	// the first step we have to do is grab a list of every file in the source tree
	const sourceFiles: string[] = glob.sync('src/{routes,components}/*.svelte')

	// make sure the artifact directory exists
	await mkdirp(config.artifactDirectory)

	// we need to collect all of the fragment definitions before we can do anything for operations
	const firstPass: Array<FirstPassDocument> = []

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

								// the document we'll register
								firstPass.push({
									name: definition.name.value,
									raw: rawDocument,
									parsed: definition as
										| graphql.FragmentDefinitionNode
										| graphql.OperationDefinitionNode,
									kind: definition.kind,
								})
							}
						},
					})
				})
			)
		})
	)

	// index the fragments by name
	const fragments: { [name: string]: Document } = {}

	// now that we have references to every fragment we can build up the dependency graph
	const docs = await Promise.all(
		Object.values(firstPass).map(async (document) => {
			// add the fragment dependencies to the document
			const doc = {
				...document,
				requiredFragments: findRequiredFragments(document.parsed.selectionSet),
			}

			// if the document is a fragment
			if (doc.kind === GraphqlKinds.FRAGMENT_DEFINITION) {
				fragments[doc.name] = doc
			}

			return doc
		})
	)

	// write the artifacts
	await Promise.all(
		Object.values(docs).map(async (document) => {
			// the location we will put the operation artifact
			const targetLocation = path.join(
				config.artifactDirectory,
				`${document.name}.graphql.ts`
			)

			// start building up the artiface
			const artifact = AST.program([
				AST.exportNamedDeclaration(
					AST.variableDeclaration('const', [
						AST.variableDeclarator(
							AST.identifier('name'),
							AST.stringLiteral(document.name || 'NO_NAME')
						),
					])
				),
				AST.exportNamedDeclaration(
					AST.variableDeclaration('const', [
						AST.variableDeclarator(
							AST.identifier('kind'),
							AST.stringLiteral(document.kind)
						),
					])
				),
			])

			// we might have to add document kind specific exports
			if (document.kind === GraphqlKinds.OPERATION_DEFINITION) {
				artifact.body.push(...operationExports(config, fragments, document))
			}
			// its a fragment definition so add those exports
			else {
				artifact.body.push(...fragmentExports(config, document))
			}

			// write the result
			await fs.writeFile(targetLocation, recast.print(artifact).code)

			// log the file location to confirm
			console.log(document.name)
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

function operationExports(
	config: Config,
	fragments: { [name: string]: Document },
	operation: Document
): StatementKind[] {
	// we need a flat list of every fragment used by the operation
	const operationFragments = flattenFragments(operation, fragments).map(
		(fragmentName) => fragments[fragmentName].raw
	)

	// build up the query string
	const rawString = [operation.raw, ...operationFragments].join('')

	// an operation artifact is a javascript file in the appropriate directory.
	// we'll build it up as an ast and then print it to the right spot
	return [
		AST.exportNamedDeclaration(
			AST.variableDeclaration('const', [
				AST.variableDeclarator(
					AST.identifier('raw'),
					AST.templateLiteral(
						[AST.templateElement({ raw: rawString, cooked: rawString }, true)],
						[]
					)
				),
			])
		),
	]
}

function fragmentExports(config: Config, fragment: Document): StatementKind[] {
	// dry
	const rawString = fragment.raw

	return [
		AST.exportNamedDeclaration(
			AST.variableDeclaration('const', [
				AST.variableDeclarator(
					AST.identifier('raw'),
					AST.templateLiteral(
						[AST.templateElement({ raw: rawString, cooked: rawString }, true)],
						[]
					)
				),
			])
		),
	]
}

// take a list of required fragments and turn it into a list of fragments
// needed to create the query document
export function flattenFragments(
	operation: { requiredFragments: Array<string> },
	fragments: { [name: string]: { requiredFragments: Array<string> } }
): Array<string> {
	// the list of fragments to return
	const frags = new Set<string>()

	// we're going to do this as a breadth-first search to avoid creating
	// duplicates. If we did this a depth-first we would process dependent
	// fragments after we check if we've already processed this node

	// the list of fragments we still have to process
	const remaining = [...operation.requiredFragments]

	// make sure we hit every node
	while (remaining.length > 0) {
		// grab the fragment we are going to add
		const nextFragment = remaining.shift()

		// make sure we got something
		if (!nextFragment) {
			continue
		}

		// if we haven't seen this fragment before we need to add it to the pile
		if (!frags.has(nextFragment)) {
			frags.add(nextFragment)
		}
		// we have seen this value already
		else {
			continue
		}

		// grab the referenced fragment
		const targetFragment = fragments[nextFragment]
		if (!targetFragment) {
			throw new Error('Could not find definition for fragment ' + nextFragment)
		}

		// add this framgnets dependents to the pile
		remaining.push(...targetFragment.requiredFragments)
	}

	// we're done
	return [...frags]
}
