import { readFileSync, writeFileSync } from 'fs'
import type { Plugin as VitePlugin, ModuleNode, HmrContext } from 'vite'

import type { VitePluginContext } from './index.js'
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
	let config: Awaited<ReturnType<typeof get_config>>
	// Tracks files we re-wrote via writeFileSync so we can skip the resulting
	// hotUpdate events. Uses timestamps instead of a Set because Vite 8 fires
	// hotUpdate twice per change (once per environment: client + ssr), so a
	// one-shot Set entry would be consumed by the first call and the second
	// would slip through causing an infinite loop.
	const ownWrites = new Map<string, number>() // filepath → Date.now() of write

	return {
		name: 'houdini',

		enforce: 'pre',

		// this is called when the dev server starts
		async configureServer(server) {
			config = await get_config()

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
		hotUpdate(opts) {
			if (opts.type === 'delete') return
			const ownWriteTime = ownWrites.get(opts.file)
			if (ownWriteTime !== undefined) {
				if (Date.now() - ownWriteTime < 500) return [] // both env calls skipped within 500ms
				ownWrites.delete(opts.file)
			}
			const server = opts.server
			// Suppress Vite's default HMR cascade for generated runtime files.
			// Houdini explicitly invalidates and reloads these after the full
			// pipeline completes — watcher-driven events fire mid-pipeline and
			// can trigger ssrLoadModule on a partially-written manifest.ts.
			const generatedDir = path.join(
				server.config.root,
				ctx.config.config_file.runtimeDir ?? '.houdini'
			)
			if (opts.file.startsWith(generatedDir + '/') || opts.file === generatedDir) {
				return []
			}
			return debounceHmr(opts as unknown as HmrContext, async (files, task_id) => {
				// look for all relevant files that have houdini dependencies
				const filepaths: Array<string> = []
				const relativePaths: Array<string> = []
				// server.config.root may be '/' in WebContainers; appending a slash
				// before slicing avoids stripping the first character of the path.
				const rootPrefix = server.config.root.endsWith('/')
					? server.config.root
					: server.config.root + '/'
				// In WASI/stdio mode the Go binary's filesystem root (/) is mapped to
				// the project root on the host, so host-level absolute paths are
				// inaccessible. Use the WASI-namespaced path (/src/...) instead.
				const useStdio = config.config_file.pluginTransport === 'stdio'
				for (const [filepath, content] of Object.entries(files)) {
					if (
						content !== null &&
						!filepath.includes(
							path.join(
								server.config.root,
								ctx.config.config_file.runtimeDir ?? '.houdini'
							)
						) &&
						(filepath.endsWith('.gql') || content.includes('$houdini'))
					) {
						const relPath = filepath.substring(rootPrefix.length)
						relativePaths.push(relPath)
						filepaths.push(filepath)
						// In WASI mode, wc.fs.writeFile (browser API) doesn't propagate to
						// the WASI filesystem. Re-write via Node.js fs so the Go binary can
						// read the file through its WASI fd_open syscall.
						if (useStdio && content !== null) {
							// opts.read() can return "" for newly-created .gql files when
							// the second Vite env call overwrote the first in the debounce
							// queue, or due to a VFS timing race on the create event.
							// Fall back to readFileSync so we never write empty content.
							let fileContent = content
							if (fileContent.trim() === '' && filepath.endsWith('.gql')) {
								try {
									fileContent = readFileSync(filepath, 'utf-8')
								} catch {}
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
					ctx.db.reload()
					throw err
				}

				// ctx.db is reloaded by trigger_hook — mark extracted documents for this task
				ctx.db.run(`UPDATE raw_documents SET current_task = ? WHERE ${eqClause}`, [
					task_id,
					...relativePaths,
				])
				const changes = ctx.db.rowsModified()

				// if the update did not contain any changes, then there were no extracted files
				if (changes === 0) {
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
              WHERE printed IS NOT NULL
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
				const results = await run_pipeline(compiler.trigger_hook, {
					task_id,
					after: 'AfterExtract',
				})

				// ctx.db is reloaded by the last trigger_hook inside run_pipeline
				const taskDocCount =
					ctx.db.get<{ count: number }>(
						`SELECT COUNT(DISTINCT d.id) as count
						 FROM documents d
						 JOIN raw_documents rd ON rd.id = d.raw_document
						 WHERE rd.current_task = ?`,
						[task_id]
					)?.count ?? 0
				console.log(
					`🎩 Updated ${taskDocCount} ${taskDocCount === 1 ? 'document' : 'documents'}`
				)

				// the return value of each generate invocation is the list of modules that were updated
				const updated_modules = [
					...Object.values(results.GenerateDocuments || {}).flat(),
					...Object.values(results.GenerateRuntime || {}).flat(),
				] as Array<string>

				// remove the task id association
				ctx.db.run(`UPDATE raw_documents SET current_task = NULL WHERE current_task = ?`, [
					task_id,
				])

				// invalidate all of the modules we generated
				for (const module_path of updated_modules) {
					const mod = server.moduleGraph.getModuleById(module_path)
					if (mod) {
						server.moduleGraph.invalidateModule(mod)
					}
				}

				// Trigger a full page reload so the browser gets the updated manifest and
				// page units without racing against a reload from the .tsx file change.
				if (updated_modules.length > 0) {
					server.ws.send({ type: 'full-reload' })
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
		// Add file and its read function to queue. Don't overwrite an existing entry
		// for the same file — Vite 8 fires hotUpdate once per environment (client +
		// ssr) and the second env's read function may return empty for newly-created
		// files. Keeping the first readFn is safe because the debounce window is
		// 50ms, which is far longer than the microsecond gap between env calls.
		if (!updateQueue.has(ctx.file)) {
			updateQueue.set(ctx.file, ctx.read)
		}

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
							filesWithContent[filepath] = await readFn()
						} catch {
							// file disappeared between the HMR event and now — skip it
						}
					})
				)

				try {
					await callback(filesWithContent, currentBatchId.toString())
				} catch (err) {
					console.error('[houdini] HMR pipeline error:', err)
				}

				// Drain any pending batches that accumulated while we were processing
				while (pendingBatch) {
					const { files: nextFiles, batchId: nextBatchId } = pendingBatch
					pendingBatch = null

					const nextFilesWithContent: Record<string, string> = {}
					await Promise.all(
						Array.from(nextFiles.entries()).map(async ([filepath, readFn]) => {
							try {
								nextFilesWithContent[filepath] = await readFn()
							} catch {
								// file disappeared between the HMR event and now — skip it
							}
						})
					)

					try {
						await callback(nextFilesWithContent, nextBatchId.toString())
					} catch (err) {
						console.error('[houdini] HMR pipeline error:', err)
					}
				}
			} finally {
				isProcessing = false
			}
		}, debounceMs)
	}
}
