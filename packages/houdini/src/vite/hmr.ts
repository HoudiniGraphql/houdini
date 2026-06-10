import { readFileSync, writeFileSync } from 'fs'
import type { HmrContext, Plugin as VitePlugin } from 'vite'
import { type CompilerProxy, codegen_setup, get_config, path, run_pipeline } from '../lib/index.js'
import type { VitePluginContext } from './index.js'

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
	let config: Awaited<ReturnType<typeof get_config>>
	// Tracks files we re-wrote via writeFileSync so we can skip the resulting
	// hotUpdate events. Uses timestamps instead of a Set because Vite 8 fires
	// hotUpdate twice per change (once per environment: client + ssr), so a
	// one-shot Set entry would be consumed by the first call and the second
	// would slip through causing an infinite loop.
	const ownWrites = new Map<string, number>() // filepath → Date.now() of write
	// Stable after configureServer; hoisted so hotUpdate doesn't recompute on every event.
	let generatedDir: string
	let rootPrefix: string
	// Files that had graphql documents but whose latest content no longer contains $houdini.
	// Tracked so the debounce callback can still pass them to the pipeline for artifact cleanup.
	const cleanupFiles = new Set<string>()

	return {
		name: 'houdini',

		enforce: 'pre',

		// this is called when the dev server starts
		async configureServer(server) {
			config = await get_config()

			// and a proxy to talk to the compiler
			compiler = await codegen_setup(config, 'dev', ctx.db, ctx.db_file)

			generatedDir = path.join(
				server.config.root,
				ctx.config.config_file.runtimeDir ?? '.houdini'
			)
			rootPrefix = server.config.root.endsWith('/')
				? server.config.root
				: `${server.config.root}/`

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
				// trigger_hook already reloaded ctx.db after the last pipeline step
				const docCount = ctx.db.get<{ count: number }>(
					'SELECT COUNT(*) as count FROM documents WHERE visible = 1'
				)
				console.log(
					`🎩 Generated ${docCount?.count ?? 0} ${(docCount?.count ?? 0) === 1 ? 'document' : 'documents'}`
				)
			} catch {}
		},

		// hotUpdate is called for 'create', 'update', and 'delete' events in Vite 8+.
		// The legacy handleHotUpdate hook is only called for 'update', so new .gql files
		// (type === 'create') would be silently ignored without this hook.
		// Async so we can read file content eagerly to determine ownership before debouncing.
		async hotUpdate(opts) {
			// configureServer may not have run yet if watcher fires during startup
			if (!generatedDir) return

			// Sweep stale own-write entries to prevent unbounded map growth.
			const now = Date.now()
			for (const [fp, ts] of ownWrites.entries()) {
				if (now - ts > 1000) ownWrites.delete(fp)
			}

			const server = opts.server
			// Suppress Vite's default HMR cascade for generated runtime files.
			// Houdini explicitly invalidates and reloads these after the full
			// pipeline completes — watcher-driven events fire mid-pipeline and
			// can trigger ssrLoadModule on a partially-written manifest.ts.
			if (opts.file.startsWith(`${generatedDir}/`) || opts.file === generatedDir) {
				return []
			}

			// Handle file deletions that may contain graphql documents.
			if (opts.type === 'delete') {
				const relPath = opts.file.substring(rootPrefix.length)
				// For non-.gql files, only proceed if the DB has rows for this path.
				// This avoids a pipeline run when deleting unrelated source files.
				if (!opts.file.endsWith('.gql')) {
					const rowCount =
						ctx.db.get<{ count: number }>(
							'SELECT COUNT(*) as count FROM raw_documents WHERE filepath = ?',
							[relPath]
						)?.count ?? 0
					if (rowCount === 0) return
				}
				debounceHmr.queueDelete(relPath, batchCallback)
				return []
			}

			const ownWriteTime = ownWrites.get(opts.file)
			if (ownWriteTime !== undefined) {
				if (Date.now() - ownWriteTime < 500) return [] // both env calls skipped within 500ms
				ownWrites.delete(opts.file)
			}

			// .gql files are always Houdini's domain.
			// For other files, read content now to check for $houdini — this also
			// avoids a redundant read inside the debounce callback.
			let preReadContent: string | null = null
			if (!opts.file.endsWith('.gql')) {
				try {
					preReadContent = await opts.read()
				} catch {
					return
				}
				if (!preReadContent.includes('$houdini')) {
					// Check whether this file previously had graphql documents in the DB.
					// If so, fall through so the pipeline can delete the stale artifacts.
					const relPath = opts.file.substring(rootPrefix.length)
					const rowCount =
						ctx.db.get<{ count: number }>(
							'SELECT COUNT(*) as count FROM raw_documents WHERE filepath = ?',
							[relPath]
						)?.count ?? 0
					if (rowCount === 0) return // not a Houdini file — let Vite handle it normally
					cleanupFiles.add(opts.file)
				}
			}

			// Returning undefined lets Vite apply its normal per-module HMR for the
			// source file immediately. After the pipeline completes, we send targeted
			// js-update messages for whichever artifact modules changed.
			debounceHmr.queueUpdate(opts as unknown as HmrContext, preReadContent, batchCallback)

			async function batchCallback(
				files: Record<string, string>,
				deletedFiles: string[],
				task_id: string
			) {
				// hotUpdate can fire before configureServer completes during startup
				if (!compiler) return
				await compiler.pipeline_lock(async () => {
					// Remove DB entries for deleted files first so extraction and cleanup
					// see a consistent state for both deletions and updates in the same batch.
					if (deletedFiles.length > 0) {
						const delClause = deletedFiles.map(() => 'filepath = ?').join(' OR ')
						ctx.db.run(`DELETE FROM raw_documents WHERE ${delClause}`, deletedFiles)
					}

					// look for all relevant files that have houdini dependencies
					const filepaths: Array<string> = []
					const relativePaths: Array<string> = []
					// In WASI/stdio mode the Go binary's filesystem root (/) is mapped to
					// the project root on the host, so host-level absolute paths are
					// inaccessible. Use the WASI-namespaced path (/src/...) instead.
					const useStdio = config.config_file.pluginTransport === 'stdio'
					for (const [filepath, content] of Object.entries(files)) {
						if (
							!filepath.includes(generatedDir) &&
							(filepath.endsWith('.gql') ||
								content.includes('$houdini') ||
								cleanupFiles.delete(filepath))
						) {
							const relPath = filepath.substring(rootPrefix.length)
							relativePaths.push(relPath)
							filepaths.push(filepath)
							// In WASI mode, wc.fs.writeFile (browser API) doesn't propagate to
							// the WASI filesystem. Re-write via Node.js fs so the Go binary can
							// read the file through its WASI fd_open syscall.
							if (useStdio) {
								// Always re-read from disk — the debounce queue may hold content
								// from an earlier save if the user saved twice within the debounce
								// window. Use the queued content only as a fallback for files that
								// haven't been flushed to disk yet (e.g. brand-new .gql files).
								let fileContent: string
								try {
									fileContent = readFileSync(filepath, 'utf-8')
								} catch {
									fileContent = content
								}
								if (fileContent.trim() !== '') {
									ownWrites.set(filepath, Date.now())
									try {
										writeFileSync(filepath, fileContent, 'utf-8')
									} catch {
										ownWrites.delete(filepath)
									}
								}
							}
						}
					}

					if (filepaths.length === 0) {
						// Pure deletion batch — no files to extract. Clean up dangling DB
						// state and regenerate artifacts without the removed documents.
						if (deletedFiles.length > 0) {
							console.log(
								`🎩 Detected ${deletedFiles.length} deleted ${deletedFiles.length === 1 ? 'file' : 'files'}, re-running compiler`
							)
							ctx.db.run(`
								UPDATE selections AS s
								SET field_name = s.fragment_ref
								WHERE s.fragment_ref IS NOT NULL
								  AND s.kind = 'fragment'
								  AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.name = s.field_name)
							`)
							ctx.db.run(`
								WITH orphan_selections AS (
								  SELECT s.id FROM selections s
								  LEFT JOIN selection_refs rp ON rp.parent_id = s.id
								  LEFT JOIN selection_refs rc ON rc.child_id = s.id
								  WHERE rp.id IS NULL AND rc.id IS NULL
								)
								DELETE FROM selections WHERE id IN (SELECT id FROM orphan_selections)
							`)
							try {
								const results = await run_pipeline(compiler.trigger_hook, {
									after: 'AfterExtract',
								})
								const updated_modules = [
									...Object.values(results.GenerateDocuments || {}).flat(),
									...Object.values(results.GenerateRuntime || {}).flat(),
								] as Array<string>
								const seenUrls = new Set<string>()
								const updates = updated_modules.flatMap((module_path) => {
									const resolvedPath = module_path.startsWith('$houdini/')
										? module_path.replace('$houdini', generatedDir)
										: module_path
									const mods = [
										...(server.moduleGraph.getModulesByFile(resolvedPath) ?? []),
									]
									return mods.flatMap((mod) => {
										if (seenUrls.has(mod.url)) return []
										seenUrls.add(mod.url)
										server.moduleGraph.invalidateModule(mod)
										return [
											{
												type: 'js-update' as const,
												path: mod.url,
												acceptedPath: mod.url,
												timestamp: Date.now(),
											},
										]
									})
								})
								if (updates.length > 0) {
									server.ws.send({ type: 'update', updates })
								}
							} catch (err) {
								console.error('[houdini] pipeline error after deletion:', err)
							}
						}
						return
					}

					const fileCount = filepaths.length
					console.log(
						`🎩 Detected ${fileCount} file ${
							fileCount === 1 ? 'change' : 'changes'
						}, re-running compiler`
					)

					// SQLite's IN (?,?) requires one placeholder per value; use OR conditions
					// so the clause scales to any number of changed files.
					const eqClause = relativePaths.map(() => 'filepath = ?').join(' OR ')

					// Save rows before deletion so we can restore them if extraction fails,
					// allowing the user to retry by saving the file again.
					type RawDoc = {
						id: number
						offset_line: number | null
						offset_column: number | null
						filepath: string
						content: string
						current_task: string | null
						loaded_with: string | null
					}
					const savedDocs = ctx.db.all<RawDoc>(
						`SELECT id, offset_line, offset_column, filepath, content, current_task, loaded_with
						 FROM raw_documents WHERE ${eqClause}`,
						relativePaths
					)

					// blow away raw documents for the changed files
					ctx.db.run(`DELETE from raw_documents WHERE ${eqClause}`, relativePaths)

					// patch up fragment spreads that may have lost their expanded documents
					ctx.db.run(`
			  UPDATE selections AS s
			  SET field_name = s.fragment_ref
			  WHERE s.fragment_ref IS NOT NULL
			    AND s.kind = 'fragment'
			    AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.name = s.field_name)
			`)

					// clean up dangling selections with no refs in either direction
					ctx.db.run(`
			      WITH orphan_selections AS (
			        SELECT s.id FROM selections s
			        LEFT JOIN selection_refs rp ON rp.parent_id = s.id
			        LEFT JOIN selection_refs rc ON rc.child_id = s.id
			        WHERE rp.id IS NULL AND rc.id IS NULL
			      )
			      DELETE FROM selections WHERE id IN (SELECT id FROM orphan_selections)
			  `)

					// trigger_hook flushes before Go runs and reloads after
					try {
						await compiler.trigger_hook('ExtractDocuments', {
							payload: { filepaths },
						})
					} catch (err) {
						// Restore deleted rows so the next save re-triggers extraction.
						for (const doc of savedDocs) {
							try {
								ctx.db.run(
									`INSERT OR IGNORE INTO raw_documents
									 (offset_line, offset_column, filepath, content, loaded_with)
									 VALUES (?, ?, ?, ?, ?)`,
									[
										doc.offset_line,
										doc.offset_column,
										doc.filepath,
										doc.content,
										doc.loaded_with,
									]
								)
							} catch {}
						}
						ctx.db.flush()
						ctx.db.reload()
						throw err
					}

					// ctx.db is reloaded by trigger_hook — mark extracted documents for this task
					ctx.db.run(`UPDATE raw_documents SET current_task = ? WHERE ${eqClause}`, [
						task_id,
						...relativePaths,
					])
					const changes = ctx.db.rowsModified()

					// Skip only if there were no documents before and none were found now.
					// If savedDocs had rows but nothing was re-extracted (changes === 0), the user
					// removed all graphql calls — still need the pipeline to clean up stale artifacts.
					if (changes === 0 && savedDocs.length === 0) {
						return
					}

					// trigger_hook handles flush before AfterExtract and reload after
					await compiler.trigger_hook('AfterExtract', { task_id })

					// walk the dependency graph and include transitive dependencies in the task
					ctx.db.run(
						`
			      WITH RECURSIVE
			      seed AS (
			        SELECT DISTINCT d.name FROM raw_documents rd
			        JOIN documents d ON d.raw_document = rd.id
			        WHERE rd.current_task = $task_id
			      ),
			      up AS (
			        SELECT name FROM seed
			        UNION
			        SELECT d2.name FROM up u
			        JOIN document_dependencies dd ON dd.depends_on = u.name
			        JOIN documents d2 ON d2.id = dd.document
			      ),
			      down AS (
			        SELECT name FROM seed
			        UNION
			        SELECT dd.depends_on FROM down v
			        JOIN documents d ON d.name = v.name
			        JOIN document_dependencies dd ON dd.document = d.id
			      ),
			      targets_up AS (
			        SELECT DISTINCT d.raw_document AS raw_id FROM documents d
			        JOIN up u ON u.name = d.name WHERE d.raw_document IS NOT NULL
			      ),
			      targets_down AS (
			        SELECT DISTINCT d.raw_document AS raw_id FROM documents d
			        JOIN down v ON v.name = d.name
			        JOIN raw_documents rd ON rd.id = d.raw_document
			        WHERE d.raw_document IS NOT NULL
			      ),
			      targets AS (SELECT raw_id FROM targets_up UNION SELECT raw_id FROM targets_down)
			      UPDATE raw_documents SET current_task = $task_id
			      WHERE id IN (SELECT raw_id FROM targets)
			    `,
						{ $task_id: task_id }
					)

					// the task now includes every document that we need to process.
					// BeforeValidate → Validate → AfterValidate → GenerateDocuments → GenerateRuntime
					let results: Awaited<ReturnType<typeof run_pipeline>>
					let taskDocCount = 0
					try {
						results = await run_pipeline(compiler.trigger_hook, {
							task_id,
							after: 'AfterExtract',
						})
						// Count before finally clears current_task — querying after would always give 0.
						taskDocCount =
							ctx.db.get<{ count: number }>(
								`SELECT COUNT(DISTINCT d.id) as count
								 FROM documents d
								 JOIN raw_documents rd ON rd.id = d.raw_document
								 WHERE rd.current_task = ?`,
								[task_id]
							)?.count ?? 0
					} finally {
						// Always clear the task association, even on pipeline failure, so
						// stale current_task values don't bleed into the next HMR run.
						ctx.db.run(
							`UPDATE raw_documents SET current_task = NULL WHERE current_task = ?`,
							[task_id]
						)
					}
					console.log(
						`🎩 Updated ${taskDocCount} ${taskDocCount === 1 ? 'document' : 'documents'}`
					)

					const updated_modules = [
						...Object.values(results.GenerateDocuments || {}).flat(),
						...Object.values(results.GenerateRuntime || {}).flat(),
					] as Array<string>

					const seenUrls = new Set<string>()
					const updates = updated_modules.flatMap((module_path) => {
						// GenerateDocuments returns '$houdini/...' import aliases; resolve them
						// to absolute paths so Vite's module graph lookups work.
						const resolvedPath = module_path.startsWith('$houdini/')
							? module_path.replace('$houdini', generatedDir)
							: module_path
						const mods = [...(server.moduleGraph.getModulesByFile(resolvedPath) ?? [])]
						return mods.flatMap((mod) => {
							if (seenUrls.has(mod.url)) return []
							seenUrls.add(mod.url)
							server.moduleGraph.invalidateModule(mod)
							return [
								{
									type: 'js-update' as const,
									path: mod.url,
									acceptedPath: mod.url,
									timestamp: Date.now(),
								},
							]
						})
					})
					if (updates.length > 0) {
						server.ws.send({ type: 'update', updates })
					}
				})
			}
		},
	}
}

type BatchCallback = (
	filesWithContent: Record<string, string>,
	deletedFiles: string[],
	batchId: string
) => void | Promise<void>

type ReadFnOrContent = string | (() => string | Promise<string>)

export function createDebounceHmr(debounceMs: number = 50) {
	const updateQueue = new Map<string, ReadFnOrContent>()
	const deleteQueue = new Set<string>()
	let updateTimer: NodeJS.Timeout | null = null
	let batchId = 0
	let isProcessing = false
	let pendingBatch: {
		files: Map<string, ReadFnOrContent>
		deletedFiles: Set<string>
		batchId: number
	} | null = null

	function scheduleFlush(callback: BatchCallback) {
		if (updateTimer) {
			clearTimeout(updateTimer)
		}

		updateTimer = setTimeout(async () => {
			const filesToProcess = new Map(updateQueue)
			const filesToDelete = new Set(deleteQueue)
			const currentBatchId = ++batchId
			updateQueue.clear()
			deleteQueue.clear()
			updateTimer = null

			// Handle overlapping batches: merge instead of overwriting so no
			// intermediate batch is silently dropped.
			if (isProcessing) {
				if (pendingBatch) {
					for (const [fp, entry] of filesToProcess.entries()) {
						pendingBatch.files.set(fp, entry) // newer content wins for same path
					}
					for (const relPath of filesToDelete) {
						pendingBatch.deletedFiles.add(relPath)
					}
					pendingBatch.batchId = currentBatchId
				} else {
					pendingBatch = {
						files: filesToProcess,
						deletedFiles: filesToDelete,
						batchId: currentBatchId,
					}
				}
				return
			}

			isProcessing = true

			try {
				// Read all files in parallel
				const filesWithContent: Record<string, string> = {}
				await Promise.all(
					Array.from(filesToProcess.entries()).map(async ([filepath, entry]) => {
						try {
							filesWithContent[filepath] =
								typeof entry === 'string' ? entry : await entry()
						} catch {
							// file disappeared between the HMR event and now — skip it
						}
					})
				)

				try {
					await callback(filesWithContent, [...filesToDelete], currentBatchId.toString())
				} catch (err) {
					console.error('[houdini] HMR pipeline error:', err)
				}

				// Drain any pending batches that accumulated while we were processing
				while (pendingBatch) {
					const {
						files: nextFiles,
						deletedFiles: nextDeleted,
						batchId: nextBatchId,
					} = pendingBatch
					pendingBatch = null

					const nextFilesWithContent: Record<string, string> = {}
					await Promise.all(
						Array.from(nextFiles.entries()).map(async ([filepath, entry]) => {
							try {
								nextFilesWithContent[filepath] =
									typeof entry === 'string' ? entry : await entry()
							} catch {
								// file disappeared between the HMR event and now — skip it
							}
						})
					)

					try {
						await callback(
							nextFilesWithContent,
							[...nextDeleted],
							nextBatchId.toString()
						)
					} catch (err) {
						console.error('[houdini] HMR pipeline error:', err)
					}
				}
			} finally {
				isProcessing = false
			}
		}, debounceMs)
	}

	return {
		queueUpdate(
			ctx: HmrContext,
			preReadContent: string | null,
			callback: BatchCallback
		): void {
			// Add file and its content (or read function) to queue. Don't overwrite an
			// existing entry for the same file — Vite 8 fires hotUpdate once per environment
			// (client + ssr) and the second env's content may be empty for newly-created
			// files. Keeping the first content/readFn is safe because the debounce window
			// (50ms) is far longer than the microsecond gap between env calls.
			if (!updateQueue.has(ctx.file)) {
				updateQueue.set(ctx.file, preReadContent !== null ? preReadContent : ctx.read)
			}
			scheduleFlush(callback)
		},
		queueDelete(relativePath: string, callback: BatchCallback): void {
			deleteQueue.add(relativePath)
			scheduleFlush(callback)
		},
	}
}
