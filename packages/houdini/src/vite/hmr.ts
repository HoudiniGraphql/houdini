import fs from 'node:fs/promises'
import type { DatabaseSync } from 'node:sqlite'
import type { Plugin as VitePlugin, ModuleNode, HmrContext } from 'vite'

import type { VitePluginContext } from '.'
import {
	codegen_setup,
	get_config,
	path,
	run_pipeline,
	type CompilerProxy,
} from '../lib/index.js'

/**
 * Houdini Vite HMR Plugin
 *
 * This plugin provides hot module replacement (HMR) functionality for Houdini GraphQL documents.
 * It handles two main scenarios:
 *
 * 1. File changes: When .gql files or files containing graphql`` template literals are modified,
 *    it triggers recompilation of the affected documents and their dependencies.
 *
 * 2. Artifact imports: When a user imports an artifact (e.g., `import artifact from '$houdini/artifacts/MyQuery'`),
 *    it ensures the artifact and all its dependencies are generated before the import resolves.
 *
 * The plugin uses the same dependency resolution logic for both scenarios, walking both up and down
 * the dependency graph to ensure all related documents are properly regenerated.
 */

export let compiler: CompilerProxy

export function document_hmr(ctx: VitePluginContext): VitePlugin {
	const debounceHmr = createDebounceHmr(50) // 50ms debounce window

	const debounceArtifacts = createDebounceQueue<string>(
		200, // 50ms debounce window for artifacts
		(artifacts) => Array.from(artifacts), // convert Set to Array
		async (artifactNames) => {
			try {
				await ensureArtifactsGenerated(artifactNames, ctx.db, compiler)
			} catch (error) {
				console.error(error)
			}
		},
	)

	return {
		name: 'houdini',

		enforce: 'pre',

		// this is called when the dev server starts
		async configureServer(server) {
			const config = await get_config()

			// and a proxy to talk to the compiler
			compiler = await codegen_setup(config, 'dev', ctx.db, ctx.db_file)

			// and make sure the compiler cleans up gracefully when the http server dies
			server.httpServer?.once('close', () => {
				compiler.close()
			})

			// before we can do anything we need to discover what documents exist on the filesystem
			// we need to trigger validate in order to discover lists which might not appear in the normal JIT path
			// TODO: discover lists earlier
			try {
				await run_pipeline(compiler.trigger_hook, {
					// the pipeline through schema is run as part of codegen_setup
					after: 'Schema',
					through: 'AfterValidate',
				})
			} catch {}

			// we also want to generate the initial file contents but skip the rest of the codegen
			try {
				await compiler.trigger_hook('GenerateRuntime')
			} catch {}
		},

		// this is called when a file is created or modified
		async handleHotUpdate(hmr): Promise<void | ModuleNode[]> {
			return debounceHmr(hmr, async (files, task_id) => {
				// the first thing we need to do is look for all of the relevant files that have houdini dependencies
				const filepaths: Array<string> = []
				const relativePaths: Array<string> = []
				for (const [filepath, content] of Object.entries(files)) {
					if (
						content !== null &&
						!filepath.includes(
							path.join(
								hmr.server.config.root,
								ctx.config.config_file.runtimeDir ?? '.houdini',
							),
						) &&
						(filepath.endsWith('.gql') || content.includes('$houdini'))
					) {
						filepaths.push(filepath)
						relativePaths.push(
							filepath.substring(hmr.server.config.root.length + 1),
						)
					}
				}
				if (filepaths.length === 0) {
					return
				}

				// ideally we would be able to check if the file's content has changed before we re-run but there could
				// be abitrary extraction logic in a plugin that means we have to instead defer to them to extract documents

				// so let's just blow away any raw documents related to the changed files and then we'll call extract
				const placeholders = relativePaths.map(() => '?').join(', ')
				ctx.db
					.prepare(
						`
            DELETE from raw_documents WHERE filepath IN (${placeholders})
        `,
					)
					.run(...relativePaths)

				// we might have lost fragment variable expanded documents so look for any documents that
				// have a fragment ref but no matching document and patch them up
				ctx.db
					.prepare(
						`
          UPDATE selections AS s
          SET field_name = s.fragment_ref
          WHERE s.fragment_ref IS NOT NULL
            AND s.kind = 'fragment'                              -- only fragment spreads
            AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.name = s.field_name)
          `,
					)
					.run()

				// clean up any dangling references
				ctx.db
					.prepare(
						`
            WITH orphan_selections AS (
              SELECT s.id
              FROM selections s
              LEFT JOIN selection_refs rp ON rp.parent_id = s.id
              LEFT JOIN selection_refs rc ON rc.child_id = s.id
              WHERE rp.id IS NULL AND rc.id IS NULL
            )
            DELETE FROM selections
            WHERE id IN (SELECT id FROM orphan_selections)
          `,
					)
					.run()

				// tell the plugin to extract the filepaths
				await compiler.trigger_hook('ExtractDocuments', {
					payload: { filepaths },
				})

				// make sure any documents that were extracted get included in the current task
				const result = ctx.db
					.prepare(
						`
              UPDATE raw_documents 
                SET current_task = ? 
              WHERE filepath IN (${placeholders})
            `,
					)
					.run(task_id, ...relativePaths)

				// if the update did not contain any changes, then there were no extracted files
				if (result.changes === 0) {
					return
				}

				// at this point, the raw_documents with the matching task ID make up the core set of documents
				// that have changed because of this update event
				//
				// instruct the compiler to parse and load the content into the database
				await compiler.trigger_hook('AfterExtract', { task_id })

				// now that all of the documents have been updated to their latest version we can
				// walk the dependency graph and include any transient dependencys to the task
				// aswell
				ctx.db
					.prepare(
						`
            WITH RECURSIVE
            -- 1) Seed: names of docs already in this task
            seed AS (
              SELECT DISTINCT d.name
              FROM raw_documents rd
              JOIN documents d ON d.raw_document = rd.id
              WHERE rd.current_task = $task_id
            ),

            -- 2) Walk UP: find docs that depend on any visited name
            up AS (
              SELECT name FROM seed
              UNION
              SELECT d2.name
              FROM up u
              JOIN document_dependencies dd ON dd.depends_on = u.name
              JOIN documents d2            ON d2.id = dd.document
              WHERE printed IS NOT NULL   -- only keep walking up if the document has been processed at some point
            ),

            -- 3) Walk DOWN: find names that any visited name depends on (transitively)
            down AS (
              SELECT name FROM seed
              UNION
              SELECT dd.depends_on
              FROM down v
              JOIN documents d          ON d.name = v.name
              JOIN document_dependencies dd ON dd.document = d.id
            ),

            -- 4) Raw docs to tag from the UP walk (no extra filter)
            targets_up AS (
              SELECT DISTINCT d.raw_document AS raw_id
              FROM documents d
              JOIN up u ON u.name = d.name
              WHERE d.raw_document IS NOT NULL
            ),

            -- 5) Raw docs to tag from the DOWN walk, but only if regen is needed
            targets_down AS (
              SELECT DISTINCT d.raw_document AS raw_id
              FROM documents d
              JOIN down v        ON v.name = d.name
              JOIN raw_documents rd ON rd.id = d.raw_document
              WHERE d.raw_document IS NOT NULL
            ),

            -- 6) Union both directions
            targets AS (
              SELECT raw_id FROM targets_up
              UNION
              SELECT raw_id FROM targets_down
            )

            -- 7) Update the task set
            UPDATE raw_documents
            SET current_task = $task_id
            WHERE id IN (SELECT raw_id FROM targets);
          `,
					)
					.run({ task_id: task_id })

				// the task now includes every document that we need to process
				const results = await run_pipeline(compiler.trigger_hook, {
					task_id,
					after: 'AfterValidate',
				})

				// the return value of each generate invocation is the list of modules that were updated
				const updated_modules = Object.values(
					results.GenerateDocuments || {},
				).flat() as Array<string>

				// and finally we can remove the task id association
				ctx.db
					.prepare(
						`UPDATE raw_documents SET current_task = NULL WHERE current_task = ?`,
					)
					.run(task_id)

				// invalidate all of the modules we generated
				for (const module_path of updated_modules) {
					const mod = hmr.server.moduleGraph.getModuleById(module_path)
					if (mod) {
						hmr.server.moduleGraph.invalidateModule(mod)
					}
				}
			})
		},

		// this is called when a module is being resolved
		async resolveId(id) {
			const runtimeDir = ctx.config.config_file.runtimeDir ?? '.houdini'

			const resolvingArtifact =
				id.startsWith(`/${runtimeDir}/artifacts`) ||
				id.includes(path.join(ctx.config.root_dir, runtimeDir, 'artifacts'))

			if (resolvingArtifact) {
				// escape regex metacharacters in runtimeDir (like the dot in `.houdini`)
				const escapedRuntimeDir = runtimeDir.replace(
					/[.*+?^${}()|[\]\\]/g,
					'\\$&',
				)

				// match .../.houdini/artifacts/<name> (ignore extension)
				const pattern = new RegExp(
					`[\\\\/]${escapedRuntimeDir}[\\\\/]artifacts[\\\\/]([^/\\\\]+?)(?:\\.[^.\\\\/]+)?$`,
				)
				const match = id.match(pattern)
				const artifactName = match ? match[1] : null

				if (artifactName && ctx.db && compiler) {
					// Add artifact to debounced queue and wait for processing to complete
					await debounceArtifacts(artifactName)
				}
			}

			return null
		},
	}
}

/**
 * Ensure that the specified artifacts and all their dependencies are generated in batch
 */
async function ensureArtifactsGenerated(
	artifactNames: string[],
	db: DatabaseSync,
	compiler: CompilerProxy,
): Promise<void> {
	if (artifactNames.length === 0) {
		return
	}

	// Filter out artifacts that already exist
	const config = await get_config()
	const artifactsToGenerate: string[] = []

	for (const artifactName of artifactNames) {
		try {
			await fs.access(
				path.join(
					config.root_dir,
					config.config_file.runtimeDir ?? '.houdini',
					'artifacts',
					artifactName + '.ts',
				),
				fs.constants.R_OK,
			)
			// if access doesn't throw, the file exists, skip it
		} catch {
			// file doesn't exist, add to generation list
			artifactsToGenerate.push(artifactName)
		}
	}

	if (artifactsToGenerate.length === 0) {
		return
	}

	const timestamp = Date.now()
	const task_id = `artifacts_batch_${timestamp}`
	console.log('ensuring artifacts generated:', artifactNames, task_id)

	// Find all documents that need to be generated
	const placeholders = artifactsToGenerate.map(() => '?').join(', ')
	const documentsQuery = db.prepare(`
		SELECT d.id, d.name, rd.id as raw_document_id
		FROM documents d
		LEFT JOIN raw_documents rd ON rd.id = d.raw_document
		WHERE d.name IN (${placeholders})
	`)
	const documents = documentsQuery.all(...artifactsToGenerate) as Array<{
		id: number
		name: string
		raw_document_id: number | null
	}>

	// Filter out documents that don't exist or don't have raw documents
	const validDocuments = documents.filter((doc) => doc.raw_document_id !== null)
	if (validDocuments.length === 0) {
		return
	}

	// Mark all documents as part of this task
	const rawDocumentIds = validDocuments.map((doc) => doc.raw_document_id)
	const rawDocPlaceholders = rawDocumentIds.map(() => '?').join(', ')
	db.prepare(
		`UPDATE raw_documents SET current_task = ? WHERE id IN (${rawDocPlaceholders})`,
	).run(task_id, ...rawDocumentIds)

	// Find all dependencies using the same recursive query as handleHotUpdate
	db.prepare(
		`
			WITH RECURSIVE
			seed AS (
				SELECT DISTINCT d.name
				FROM raw_documents rd
				JOIN documents d ON d.raw_document = rd.id
				WHERE rd.current_task = $task_id
			),

			walk AS (
				SELECT name FROM seed
				UNION
				SELECT dd.depends_on
				FROM walk v
				JOIN documents d          ON d.name = v.name
				JOIN document_dependencies dd ON dd.document = d.id
			),

			targets AS (
				SELECT DISTINCT d.raw_document AS raw_id
				FROM documents d
				JOIN walk v        ON v.name = d.name
				JOIN raw_documents rd ON rd.id = d.raw_document
				WHERE d.raw_document IS NOT NULL
			)

			UPDATE raw_documents
			SET current_task = $task_id
			WHERE id IN (SELECT raw_id FROM targets);
		`,
	).run({ task_id: task_id })

	// Run the compilation pipeline for this task
	await run_pipeline(compiler.trigger_hook, {
		task_id,
		after: 'AfterValidate',
	})

	// Clean up the task
	db.prepare(
		`UPDATE raw_documents SET current_task = NULL WHERE current_task = ?`,
	).run(task_id)
}

type BatchCallback = (
	filesWithContent: Record<string, string>,
	batchId: string,
) => void | Promise<void>

/**
 * Creates a generic debounced queue handler that batches items
 * @param debounceMs - Debounce window in milliseconds
 * @param transform - Function to transform the collected items before processing
 * @param callback - Function to process the transformed items
 * @returns debounce function that returns a Promise
 */
export function createDebounceQueue<T, R = T[]>(
	debounceMs: number,
	transform: (items: Set<T>) => R,
	callback: (transformedItems: R) => void | Promise<void>,
) {
	const itemQueue = new Set<T>()
	const pendingPromises = new Map<
		T,
		{ resolve: () => void; reject: (error: any) => void }
	>()
	let timer: NodeJS.Timeout | null = null

	return function debounceQueue(item: T): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			// Add item to queue and store its promise resolvers
			itemQueue.add(item)
			pendingPromises.set(item, { resolve, reject })

			// Clear existing timer
			if (timer) {
				clearTimeout(timer)
			}

			// Set new timer
			timer = setTimeout(async () => {
				// Capture current queue and promises
				const itemsToProcess = new Set(itemQueue)
				const promisesToResolve = new Map(pendingPromises)
				itemQueue.clear()
				pendingPromises.clear()
				timer = null

				try {
					const transformedItems = transform(itemsToProcess)
					await callback(transformedItems)

					// Resolve all promises for processed items
					promisesToResolve.forEach(({ resolve }) => {
						resolve()
					})
				} catch (error) {
					// Reject all promises on error
					promisesToResolve.forEach(({ reject }) => {
						reject(error)
					})
				}
			}, debounceMs)
		})
	}
}

/**
 * Creates a debounced HMR handler that batches file changes
 * @param debounceMs - Debounce window in milliseconds
 * @returns debounceHmr function
 */
export function createDebounceHmr(debounceMs: number = 50) {
	const updateQueue = new Map<string, () => string | Promise<string>>()
	let updateTimer: NodeJS.Timeout | null = null
	let batchId = 0
	let isProcessing = false
	let pendingBatch: {
		files: Map<string, () => string | Promise<string>>
		batchId: number
	} | null = null

	return function debounceHmr(ctx: HmrContext, callback: BatchCallback): void {
		// Add file and its read function to queue
		updateQueue.set(ctx.file, ctx.read)

		// Clear existing timer
		if (updateTimer) {
			clearTimeout(updateTimer)
		}

		// Set new timer
		updateTimer = setTimeout(async () => {
			// Capture current queue and increment batch ID
			const filesToProcess = new Map(updateQueue)
			const currentBatchId = ++batchId
			updateQueue.clear()
			updateTimer = null

			// Handle overlapping batches
			if (isProcessing) {
				pendingBatch = { files: filesToProcess, batchId: currentBatchId }
				return
			}

			isProcessing = true

			try {
				// Read all files in parallel
				const filesWithContent: Record<string, string> = {}
				const readPromises = Array.from(filesToProcess.entries()).map(
					async ([filepath, readFn]) => {
						try {
							const content = await readFn()
							filesWithContent[filepath] = content
						} catch (error) {
							// Store empty string or rethrow based on your needs
							filesWithContent[filepath] = ''
						}
					},
				)

				await Promise.all(readPromises)

				try {
					await callback(filesWithContent, currentBatchId.toString())
				} catch {}

				// Process any pending batch that accumulated
				if (pendingBatch) {
					const { files: nextFiles, batchId: nextBatchId } = pendingBatch
					pendingBatch = null

					// Read files for pending batch
					const nextFilesWithContent: Record<string, string> = {}
					const nextReadPromises = Array.from(nextFiles.entries()).map(
						async ([filepath, readFn]) => {
							try {
								const content = await readFn()
								nextFilesWithContent[filepath] = content
							} catch (error) {
								nextFilesWithContent[filepath] = ''
							}
						},
					)

					await Promise.all(nextReadPromises)
					try {
						await callback(nextFilesWithContent, nextBatchId.toString())
					} catch {}
				}
			} finally {
				isProcessing = false
			}
		}, debounceMs)
	}
}
