import * as graphql from 'graphql'

import {
	Config,
	runPipeline as run,
	LogLevel,
	find_graphql,
	parseJS,
	HoudiniError,
	Plugin,
	fs,
	CollectedGraphQLDocument,
	path,
} from '../lib'
import { ArtifactKind } from '../runtime/lib/types'
import * as generators from './generators'
import * as transforms from './transforms'
import * as validators from './validators'

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
	config.createDirectories()

	// reset the newSchema accumulator
	config.newSchema = ''

	// reset the newDocuments accumulator
	config.newDocuments = ''

	// we need to hold onto some stats for the generated artifacts
	const artifactStats = {
		total: [],
		changed: [],
		new: [],
		deleted: [],
	}

	// collect any plugins that need to do something after generating
	const generatePlugins = config.plugins.filter((plugin) => plugin.generate)

	// run the generate command before we print "🎩 Generating runtime..." because we don't know upfront artifactStats.
	let error: Error | null = null
	try {
		await run(
			config,
			[
				// validators
				validators.typeCheck,
				validators.uniqueNames,
				validators.noIDAlias,
				validators.plugins,

				// transforms
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

				// generators

				// the runtime is a static thing most of the time. It only needs to be regenerated if
				// the user is upgrading versions or the client path changed
				generators.runtime,
				generators.indexFile,
				generators.artifacts(artifactStats),
				generators.typescript,
				generators.persistOutput,
				generators.definitions,

				// these have to go after the artifacts so that plugins can import them
				...generatePlugins.map(
					(plugin) => async (config: Config, docs: CollectedGraphQLDocument[]) =>
						await plugin.generate!({
							config,
							documents: docs,
							plugin_root: config.pluginDirectory(plugin.name),
						})
				),
			],
			docs
		)
	} catch (e) {
		error = e as Error
	}

	/// Summary

	// count the number of unchanged
	const unchanged =
		artifactStats.total.length -
		artifactStats.changed.length -
		artifactStats.new.length -
		artifactStats.deleted.length

	// If triggered from the plugin, we show logs ONLY if there are changes.
	const printMessage = !config.pluginMode || unchanged !== artifactStats.total.length
	if (!printMessage || config.logLevel === LogLevel.Quiet) {
		if (error) {
			throw error
		}
		return
	}

	if (!config.pluginMode) {
		console.log('🎩 Generating runtime...')
	}

	if (error) {
		throw error
	}

	// print a line showing that the process is finished (wo document)
	if (artifactStats.total.length === 0) {
		console.log(`💡 No operation found. If that's unexpected, please check your config.`)
	}
	// print summaries of the changes
	else if ([LogLevel.Summary, LogLevel.ShortSummary].includes(config.logLevel)) {
		// if we have any unchanged artifacts
		if (unchanged > 0 && printMessage && !config.pluginMode) {
			console.log(`📃 Unchanged: ${unchanged}`)
		}

		logStyled('CREATED', artifactStats.new, config.logLevel, config.pluginMode)
		logStyled('UPDATED', artifactStats.changed, config.logLevel, config.pluginMode)
		logStyled('DELETED', artifactStats.deleted, config.logLevel, config.pluginMode)
	}
	// print the status of every file
	else if (config.logLevel === LogLevel.Full) {
		for (const artifact of artifactStats.total) {
			// figure out the emoji to use
			let emoji = '📃'
			if (artifactStats.changed.includes(artifact)) {
				emoji = '✏️'
			} else if (artifactStats.new.includes(artifact)) {
				emoji = '✨'
			} else if (artifactStats.deleted.includes(artifact)) {
				emoji = '🧹'
			}

			// log the name
			console.log(`${emoji} ${artifact}`)
		}
	}
}

async function collectDocuments(config: Config): Promise<CollectedGraphQLDocument[]> {
	// the first step we have to do is grab a list of every file in the source tree
	let sourceFiles = await config.sourceFiles()

	// the list of documents we found
	const documents: DiscoveredDoc[] = []

	const extractors: Record<string, Plugin['extract_documents'][]> = {
		'.graphql': [],
		'.gql': [],
		'.js': [],
		'.ts': [],
	}

	// a config's set of plugins defines a priority list of ways to extract a document from a file
	// build up a mapping from extension to a list functions that extract documents
	for (const plugin of config.plugins) {
		if (plugin.extensions && plugin.extract_documents) {
			for (const extension of plugin.extensions) {
				extractors[extension] = [...(extractors[extension] || []), plugin.extract_documents]
			}
		}
	}

	// add the default extractors at the end of the appropriate lists
	const graphql_extractor = (filepath: string, content: string) => [content]
	const javascript_extractor = (filepath: string, content: string) =>
		processJSFile(config, content)
	extractors['.ts'].push(javascript_extractor)
	extractors['.js'].push(javascript_extractor)
	extractors['.graphql'].push(graphql_extractor)
	extractors['.gql'].push(graphql_extractor)

	// wait for every file to be processed
	await Promise.all(
		sourceFiles.map(async (filepath) => {
			// read the file
			const contents = await fs.readFile(filepath)
			if (!contents) {
				return
			}

			// look for extractors for the given extension
			const extension = path.extname(filepath)

			// if we don't recognize the extension but were told to include it as a
			// source file, there is likely something wrong. maybe a missing plugin?
			if (!extractors[extension]) {
				throw new HoudiniError({
					filepath,
					message:
						'Encountered a file extension that could not be processed: ' + extension,
					description: 'Please verify you are not missing a plugin.',
				})
			}

			// make sure any errors include the filepath
			try {
				// if the file ends with .svelte, we need to look for graphql template tags
				for (const extractor of extractors[extension]) {
					if (!extractor) {
						continue
					}

					const found = await extractor(filepath, contents)
					if (found.length > 0) {
						documents.push(...found.map((document) => ({ filepath, document })))
					}
				}
			} catch (err) {
				throw new HoudiniError({ ...(err as HoudiniError), filepath })
			}
		})
	)

	return await Promise.all(
		documents.map(async ({ document, filepath }) => {
			try {
				return await processGraphQLDocument(config, filepath, document)
			} catch (e) {
				throw new HoudiniError({ filepath, message: (e as unknown as Error).message })
			}
		})
	)
}

export type DiscoveredDoc = {
	filepath: string
	document: string
}

async function processJSFile(config: Config, contents: string): Promise<string[]> {
	const documents: string[] = []

	// parse the contents as js
	try {
		var program = (await parseJS(contents))!.script
	} catch (e) {
		console.log(contents)
		throw e
	}

	// look for a graphql template tag
	await find_graphql(config, program, {
		tag({ tagContent }) {
			documents.push(tagContent)
		},
	})

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
		throw new HoudiniError({
			filepath,
			message: 'Operation documents can only have one operation',
		})
	}
	// we are looking at a fragment document
	else {
		// if there is more than one fragment, throw an error
		if (fragments.length > 1) {
			throw new HoudiniError({
				filepath,
				message: 'Fragment documents can only have one fragment',
			})
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
			kind = ArtifactKind.Subscription
		}
	}

	// add it to the list
	return {
		name: config.documentName(parsedDoc),
		kind,
		document: parsedDoc,
		filename: filepath,
		originalDocument: parsedDoc,
		generateArtifact: true,
		generateStore: true,
		originalString: document,
	}
}

function logStyled(
	kind: 'CREATED' | 'UPDATED' | 'DELETED',
	stat: string[],
	logLevel: LogLevel,
	plugin: boolean
) {
	if (stat.length > 0) {
		// Let's prepare the one liner in the plugin mode, of a bit more in other lol level.
		const msg: string[] = []

		// in plugin mode, it will be very short, let's put a hat first.
		if (plugin) {
			msg.push(`🎩 `)
		}

		if (kind === 'CREATED') {
			msg.push(`✨ `)
			if (!plugin) {
				msg.push(`New: ${stat.length}`)
			}
		} else if (kind === 'UPDATED') {
			msg.push(`✏️  `)
			if (!plugin) {
				msg.push(`Changed: ${stat.length}`)
			}
		} else if (kind === 'DELETED') {
			msg.push(`🧹 `)
			if (!plugin) {
				msg.push(`Deleted: ${stat.length}`)
			}
		}

		// let's do a summary for x elements
		const nbToDisplay = 5

		// format for plugin
		if (plugin) {
			msg.push(`${stat.slice(0, nbToDisplay).join(', ')}`)
			if (stat.length > 5) {
				msg.push(`, ... ${stat.length - nbToDisplay} more`)
			}
		}

		console.log(msg.join(''))

		// Format for not plugin & Summary mode
		if (!plugin && logLevel === LogLevel.Summary) {
			for (const artifact of stat.slice(0, nbToDisplay)) {
				console.log(`    ${artifact}`)
			}
			// if there are more than 5 just tell them how many
			if (stat.length > nbToDisplay) {
				console.log(`    ... ${stat.length - nbToDisplay} more`)
			}
		}
	}
}
