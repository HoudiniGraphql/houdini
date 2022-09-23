import glob from 'glob'
import * as graphql from 'graphql'
import minimatch from 'minimatch'
import path from 'path'
import * as recast from 'recast'
import * as svelte from 'svelte/compiler'
import { promisify } from 'util'

import {
	Config,
	runPipeline as run,
	parseSvelte,
	ParsedFile,
	LogLevel,
	walkGraphQLTags,
	readFile,
	parseJS,
	HoudiniError,
} from '../common'
import { siteURL } from '../runtime/lib/constants'
import * as generators from './generators'
import * as transforms from './transforms'
import { CollectedGraphQLDocument, ArtifactKind } from './types'
import * as validators from './validators'

type Program = recast.types.namedTypes.Program

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

	// reset the newDocuments accumulator
	config.newDocuments = ''

	// we need to hold onto some stats for the generated artifacts
	const artifactStats = {
		total: [],
		changed: [],
		new: [],
		deleted: [],
	}

	// the last version the runtime was generated with
	let previousVersion = ''
	let newClientPath = false
	let newTimestamp = false
	const content = await readFile(config.metaFilePath)
	if (content) {
		try {
			const parsed = JSON.parse(content)
			previousVersion = parsed.version + parsed.createdOn
			newClientPath = parsed.client !== config.client

			// look up the source metadata (so we can figure out if the version actually changed)
			const sourceMeta = await readFile(path.join(config.runtimeSource, 'meta.json'))
			if (!sourceMeta) {
				throw new Error('skip')
			}

			// if the two timestamps are not the same, we have a new version
			newTimestamp = JSON.parse(sourceMeta).timestamp !== parsed.timestamp
		} catch {}
	}

	// generate the runtime if the version changed, if its a new project, or they changed their client path
	const generateRuntime = newTimestamp || newClientPath || !previousVersion

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
				validators.forbiddenNames,

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
				generateRuntime ? generators.runtime : null,
				generators.artifacts(artifactStats),
				generators.typescript,
				generators.persistOutput,
				generators.definitions,
				generators.stores,

				// this has to go after runtime and artifacts
				generators.kit,
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
	const printMessage = !config.plugin || unchanged !== artifactStats.total.length
	if (!printMessage || config.logLevel === LogLevel.Quiet) {
		if (error) {
			throw error
		}
		return
	}

	if (!config.plugin) {
		console.log('🎩 Generating runtime...')
	}

	if (error) {
		throw error
	}

	// if we detected a version change, we're nuking everything so don't bother with a summary
	if (newTimestamp) {
		console.log('💣 Detected new version of Houdini. Regenerating all documents...')
		console.log('🎉 Welcome to HOUDINI_VERSION!')
		// if the user is coming from a version pre-15, point them to the migration guide
		const major = parseInt(previousVersion.split('.')[1])
		if (major < 16) {
			console.log(
				`❓ For a description of what's changed, visit this guide: ${siteURL}/guides/release-notes`
			)
		}
	}
	// print a line showing that the process is finished (wo document)
	else if (artifactStats.total.length === 0) {
		console.log(`💡 No operation found. If that's unexpected, please check your config.`)
	}
	// print summaries of the changes
	else if ([LogLevel.Summary, LogLevel.ShortSummary].includes(config.logLevel)) {
		// if we have any unchanged artifacts
		if (unchanged > 0 && printMessage && !config.plugin) {
			console.log(`📃 Unchanged: ${unchanged}`)
		}

		logStyled('CREATED', artifactStats.new, config.logLevel, config.plugin)
		logStyled('UPDATED', artifactStats.changed, config.logLevel, config.plugin)
		logStyled('DELETED', artifactStats.deleted, config.logLevel, config.plugin)
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
	let sourceFiles = await promisify(glob)(`${config.include.join(',')}`)
	if (config.exclude) {
		sourceFiles = sourceFiles.filter((filepath) => {
			return !config.exclude?.some((pattern) => minimatch(filepath, pattern))
		})
	}

	// the list of documents we found
	const documents: DiscoveredDoc[] = []

	// wait for every file to be processed
	await Promise.all(
		sourceFiles.map(async (filepath) => {
			// read the file
			const contents = await readFile(filepath)
			if (!contents) {
				return
			}

			// if the file ends with .svelte, we need to look for graphql template tags
			if (filepath.endsWith('.svelte')) {
				documents.push(...(await processSvelteFile(filepath, contents)))
			} else if (filepath.endsWith('.graphql') || filepath.endsWith('.gql')) {
				documents.push({
					filepath,
					document: contents,
				})
			}
			// otherwise just treat the file as a javascript file
			else {
				documents.push(...(await processJSFile(config, filepath, contents)))
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

type DiscoveredDoc = {
	filepath: string
	document: string
}

async function processJSFile(
	config: Config,
	filepath: string,
	contents: string
): Promise<DiscoveredDoc[]> {
	const documents: DiscoveredDoc[] = []

	// parse the contents as js
	let program: Program
	try {
		program = (await parseJS(contents))!.script
	} catch (e) {
		// add the filepath to the error message
		throw new HoudiniError({ filepath, message: (e as Error).message })
	}

	// look for a graphql template tag
	await walkGraphQLTags(config, program, {
		tag(tag) {
			documents.push({ document: tag.tagContent, filepath })
		},
	})

	// we found every document in the file
	return documents
}

async function processSvelteFile(filepath: string, contents: string): Promise<DiscoveredDoc[]> {
	const documents: DiscoveredDoc[] = []

	let parsedFile: ParsedFile
	try {
		parsedFile = await parseSvelte(contents)
	} catch (e) {
		const err = e as Error

		// add the filepath to the error message
		throw new HoudiniError({
			message: `Encountered error parsing ${filepath}`,
			description: err.message,
		})
	}

	// we need to look for multiple script tags to support sveltekit
	const scripts = [parsedFile]

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
		const msg = []

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
