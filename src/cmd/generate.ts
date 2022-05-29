// externals
import glob from 'glob'
import * as svelte from 'svelte/compiler'
import fs from 'fs/promises'
import * as graphql from 'graphql'
import { promisify } from 'util'
import { Program } from '@babel/types'
// locals
import { Config, runPipeline as run, parseFile, ParsedSvelteFile } from '../common'
import { CollectedGraphQLDocument, ArtifactKind } from './types'
import * as transforms from './transforms'
import * as generators from './generators'
import * as validators from './validators'
import { log } from '../common/log'

// the main entry point of the compile script
export default async function compile(config: Config) {
	// grab the graphql documents
	const documents = await collectDocuments(config)

	// push the documents through the pipeline
	await runPipeline(config, documents)
}

// the compiler's job can be broken down into a few different tasks after the documents have been collected:
// - validate their structure
// - perform a series of transformations
// - write the corresponding artifacts to disk
export async function runPipeline(config: Config, docs: CollectedGraphQLDocument[]) {
	// we need to create the runtime folder structure
	await config.createDirectories()

	// reset the newSchema accumulator
	config.newSchema = ''

	// we need to hold onto some stats for the generated artifacts
	const artifactStats = {
		total: [],
		changed: [],
		new: [],
	}

	await run(
		config,
		[
			validators.typeCheck,
			validators.uniqueNames,
			validators.noIDAlias,
			transforms.internalSchema,
			transforms.addID,
			transforms.typename,
			// list transform must go before fragment variables
			// so that the mutation fragments are defined before they get mixed in
			transforms.list,
			// paginate transform needs to go before fragmentVariables
			// so that the variable definitions get hashed
			transforms.paginate,
			transforms.fragmentVariables,
			transforms.composeQueries,
			generators.artifacts(artifactStats),
			generators.runtime,
			generators.typescript,
			generators.persistOutput,
			generators.schema,
			generators.stores,
		],
		docs
	)

	console.log(artifactStats)
}

async function collectDocuments(config: Config): Promise<CollectedGraphQLDocument[]> {
	// the first step we have to do is grab a list of every file in the source tree
	const sourceFiles = await promisify(glob)(config.sourceGlob)

	// the list of documents we found
	const documents: DiscoveredDoc[] = []

	// wait for every file to be processed
	await Promise.all(
		sourceFiles.map(async (filepath) => {
			// read the file
			const contents = await fs.readFile(filepath, 'utf-8')

			// if the file ends with .svelte, we need to look for graphql template tags
			if (filepath.endsWith('.svelte')) {
				documents.push(...(await findGraphQLTemplates(filepath, contents)))
			}
			// otherwise just treat the file as a graphql file (the whole file contents constitute a graphql file)
			else {
				documents.push({ filepath, document: contents })
			}
		})
	)

	return await Promise.all(
		documents.map(({ document, filepath }) =>
			processGraphQLDocument(config, filepath, document)
		)
	)
}

type DiscoveredDoc = {
	filepath: string
	document: string
}

async function findGraphQLTemplates(filepath: string, contents: string): Promise<DiscoveredDoc[]> {
	const documents: DiscoveredDoc[] = []

	let parsedFile: ParsedSvelteFile
	try {
		parsedFile = await parseFile(contents)
	} catch (e) {
		const err = e as Error

		// add the filepath to the error message
		throw new Error(`Encountered error parsing ${filepath}: ` + err.message)
	}

	// we need to look for multiple script tags to support sveltekit
	const scripts = [parsedFile.instance, parsedFile.module]
		.map((script) => (script ? script.content : null))
		.filter(Boolean) as Program[]

	await Promise.all(
		scripts.map(async (jsContent) => {
			// @ts-ignore
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
						const printedDoc = node.quasi.quasis[0].value.raw

						documents.push({ document: printedDoc, filepath })
					}
				},
			})
		})
	)

	// we found every document in the file
	return documents
}

async function processGraphQLDocument(
	config: Config,
	filepath: string,
	document: string
): Promise<CollectedGraphQLDocument> {
	const parsedDoc = graphql.parse(document)

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
		throw new Error('Operation documents can only have one operation')
	}
	// we are looking at a fragment document
	else {
		// if there is more than one fragment, throw an error
		if (fragments.length > 1) {
			throw new Error('Fragment documents can only have one fragment')
		}
	}

	// figure out the document kind
	let kind = ArtifactKind.Fragment
	if (operations.length === 1) {
		// the document kind depends on the artifact

		// query
		if (operations[0].kind === 'OperationDefinition' && operations[0].operation === 'query') {
			kind = ArtifactKind.Query
		}
		// mutation
		else if (
			operations[0].kind === 'OperationDefinition' &&
			operations[0].operation === 'mutation'
		) {
			kind = ArtifactKind.Mutation
		}
		// subscription
		else if (
			operations[0].kind === 'OperationDefinition' &&
			operations[0].operation === 'subscription'
		) {
			kind = ArtifactKind.Subcription
		}
	}

	// add it to the list
	return {
		name: config.documentName(parsedDoc),
		kind,
		document: parsedDoc,
		filename: filepath,
		originalDocument: parsedDoc,
		generate: true,
	}
}
