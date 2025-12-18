import type { Plugin as VitePlugin, ModuleNode, HmrContext } from 'vite'

import type { VitePluginContext } from '.'
import { codegen_setup, get_config, path, run_pipeline, type CompilerProxy } from '../lib/index.js'

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

			// before we do anyting we neeed to make sure everything has run
			try {
				await compiler.run_pipeline({
					// the pipeline through schema is run as part of codegen_setup
					after: 'Schema',
				})
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
								ctx.config.config_file.runtimeDir ?? '.houdini'
							)
						) &&
						(filepath.endsWith('.gql') || content.includes('$houdini'))
					) {
						filepaths.push(filepath)
						relativePaths.push(filepath.substring(hmr.server.config.root.length + 1))
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
        `
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
          `
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
          `
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
            `
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
          `
					)
					.run({ task_id: task_id })

				// the task now includes every document that we need to process
				const results = await run_pipeline(compiler.trigger_hook, {
					task_id,
					after: 'AfterValidate',
				})

				// the return value of each generate invocation is the list of modules that were updated
				const updated_modules = Object.values(
					results.GenerateDocuments || {}
				).flat() as Array<string>

				// and finally we can remove the task id association
				ctx.db
					.prepare(`UPDATE raw_documents SET current_task = NULL WHERE current_task = ?`)
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
	}
}

type BatchCallback = (
	filesWithContent: Record<string, string>,
	batchId: string
) => void | Promise<void>

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
				await Promise.all(
					Array.from(filesToProcess.entries()).map(async ([filepath, readFn]) => {
						try {
							const content = await readFn()
							filesWithContent[filepath] = content
						} catch (error) {
							// Store empty string or rethrow based on your needs
							filesWithContent[filepath] = ''
						}
					})
				)

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
						}
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
