// Live validation: a fast TS pass (syntax + @with/@when arguments) published
// immediately, then the real compiler run against a buffer overlay — the file's
// documents are replaced with rows extracted from the buffer and the pipeline runs
// from extraction through validation, task-scoped. The lsp database deliberately
// tracks buffer state, not disk state; the on-save pass and the close handler
// reconcile from disk.

import { parse } from 'graphql'
import { readFileSync } from 'node:fs'
import * as nodePath from 'node:path'
import { fileURLToPath } from 'node:url'
import { DiagnosticSeverity, type Diagnostic } from 'vscode-languageserver/node.js'

import {
	PluginHookError,
	hook_errors,
	pipeline_range,
	reset_file_documents,
} from './diagnostics.js'
import { extract_blocks, type Block } from './extract.js'
import { rebuild_schema, type ServerState } from './state.js'
import { validate_block } from './validation.js'

// walk the dependency graph so documents related to the task are reprocessed too
// (same recursive walk as the HMR handler in vite/hmr.ts)
const DEPENDENCY_EXPANSION = `
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
`

let overlay_counter = 0

// the file's project-relative path, or null when it isn't overlay-eligible
// (non-file scheme, or outside the project root)
function project_path(state: ServerState, uri: string): { abs: string; rel: string } | null {
	if (!uri.startsWith('file://')) return null
	const abs = fileURLToPath(uri)
	const rel = nodePath.relative(state.root_dir, abs)
	if (rel.startsWith('..') || nodePath.isAbsolute(rel)) return null
	return { abs, rel }
}

export function register_live_validation(state: ServerState) {
	state.documents.onDidChangeContent((event) => {
		const uri = event.document.uri
		const timer = state.live_timers.get(uri)
		if (timer) clearTimeout(timer)
		state.live_timers.set(
			uri,
			setTimeout(async () => {
				state.live_timers.delete(uri)
				await state.ready
				await live_validate(state, uri)
			}, 250)
		)
	})

	// closing a dirty buffer leaves overlay state in the database and squiggles in
	// the problems panel — clear both and reconcile the file from disk
	state.documents.onDidClose(async (event) => {
		const uri = event.document.uri
		const timer = state.live_timers.get(uri)
		if (timer) {
			clearTimeout(timer)
			state.live_timers.delete(uri)
		}
		state.live_diagnostics.delete(uri)
		state.connection.sendDiagnostics({ uri, diagnostics: [] })

		await state.ready
		try {
			await reconcile_from_disk(state, uri)
		} catch (err) {
			state.connection.console.error(`[houdini-lsp] failed to reconcile closed file: ${err}`)
		}
	})
}

// one overlay per uri at a time: a change that lands while a pass is running marks
// the uri for a follow-up instead of queueing another pipeline run — the follow-up
// reads the latest buffer, so intermediate states are skipped entirely
const running = new Set<string>()
const rerun = new Set<string>()

async function live_validate(state: ServerState, uri: string) {
	if (running.has(uri)) {
		rerun.add(uri)
		return
	}
	running.add(uri)
	try {
		do {
			rerun.delete(uri)
			const doc = state.documents.get(uri)
			if (!doc) break
			await live_validate_pass(state, uri, doc.version, doc.getText())
		} while (rerun.has(uri))
	} finally {
		running.delete(uri)
		rerun.delete(uri)
	}
}

async function live_validate_pass(state: ServerState, uri: string, version: number, text: string) {
	const { connection, schema } = state
	if (!schema) return
	// never let a validation failure (eg an invalid reconstructed schema) take the
	// whole server down — this runs in a timer, so a throw here is fatal
	try {
		const blocks = extract_blocks(text, uri)

		// fast pass: syntax errors + @with/@when argument checks, published
		// immediately without a pipeline round trip
		const fast = blocks.flatMap((block) => validate_block(schema, block, state.houdini_args))
		publish_live(state, uri, fast)

		// authoritative pass: the real compiler rules against a buffer overlay.
		// unparseable blocks would just fail extraction — skip the round trip.
		const parseable = blocks.every((b) => {
			try {
				parse(b.content)
				return true
			} catch {
				return false
			}
		})
		if (!parseable || blocks.length === 0) return

		const target = project_path(state, uri)
		if (!target) return

		const overlay = await run_overlay(state, { ...target, blocks })
		if (overlay === null) return // overlay failed — keep the fast diagnostics
		// the buffer moved on while the pipeline ran; a newer pass owns publishing
		if (state.documents.get(uri)?.version !== version) return

		publish_live(state, uri, [
			...fast,
			...overlay.map((loc) => ({
				severity: DiagnosticSeverity.Error,
				range: pipeline_range(
					text,
					blocks,
					Math.max(0, (loc.line ?? 1) - 1),
					Math.max(0, loc.column ?? 0)
				),
				message: loc.message,
				source: 'houdini',
			})),
		])
	} catch (err) {
		connection.console.error(`[houdini-lsp] live validation failed: ${err}`)
	}
}

function publish_live(state: ServerState, uri: string, diagnostics: Diagnostic[]) {
	state.live_diagnostics.set(uri, diagnostics)
	state.connection.sendDiagnostics({ uri, diagnostics })
}

// a closed file's database state should reflect disk again — same overlay
// machinery, sourced from the file instead of a buffer, diagnostics discarded
async function reconcile_from_disk(state: ServerState, uri: string) {
	const target = project_path(state, uri)
	if (!target || !state.db) return

	let text: string
	try {
		text = readFileSync(target.abs, 'utf-8')
	} catch {
		// the file never existed (or was deleted): drop its rows entirely
		state.db.transaction(() => reset_file_documents(state, target.abs))
		state.db.flush()
		return
	}

	await run_overlay(state, { ...target, blocks: extract_blocks(text, uri) })
}

// an error location anchored in the overlaid file
type OverlayError = { message: string; line: number | null; column: number | null }

// Replace the file's documents with the given blocks (marked with a task id), run
// the pipeline from extraction through validation scoped to that task, and return
// the errors anchored in this file. Cross-file fallout from an unsaved buffer is
// deliberately withheld — it's reported on save.
async function run_overlay(
	state: ServerState,
	target: { abs: string; rel: string; blocks: Block[] }
): Promise<OverlayError[] | null> {
	const { connection } = state
	if (!state.compiler || !state.db) return null

	const task_id = `lsp-overlay-${++overlay_counter}`

	return state.compiler.pipeline_lock(async () => {
		const { compiler, db } = state
		if (!compiler || !db) return null

		try {
			db.transaction(() => {
				reset_file_documents(state, target.abs)
				for (const block of target.blocks) {
					db.run(
						`INSERT INTO raw_documents (filepath, content, offset_column, offset_line, current_task)
						 VALUES (?, ?, ?, ?, ?)`,
						[target.rel, block.content, block.offsetColumn, block.offsetLine, task_id]
					)
					if (block.prop) {
						const raw = db.get<{ id: number }>(`SELECT last_insert_rowid() AS id`)
						if (raw) {
							db.run(
								`INSERT INTO component_fields (document, prop, inline) VALUES (?, ?, true)`,
								[raw.id, block.prop]
							)
						}
					}
				}
			})
			db.flush()
		} catch (err) {
			connection.console.error(`[houdini-lsp] failed to overlay buffer: ${err}`)
			return null
		}

		let pipelineError: unknown = null
		try {
			await compiler.trigger_hook('AfterExtract', { task_id })
			db.reload()
			db.run(DEPENDENCY_EXPANSION, { $task_id: task_id })
			db.flush()
			await compiler.run_pipeline({
				task_id,
				after: 'AfterExtract',
				through: 'AfterValidate',
			})
		} catch (err) {
			pipelineError = err
		} finally {
			try {
				db.reload()
				db.run(`UPDATE raw_documents SET current_task = NULL WHERE current_task = ?`, [
					task_id,
				])
				db.flush()
			} catch {}
		}

		// the overlay changed the database — refresh completion state so fragments
		// added in the buffer are immediately suggestable
		try {
			rebuild_schema(state)
		} catch (err) {
			connection.console.error(`[houdini-lsp] failed to rebuild schema: ${err}`)
		}

		if (!pipelineError) return []
		if (!(pipelineError instanceof PluginHookError)) {
			connection.console.error(`[houdini-lsp] overlay validation error: ${pipelineError}`)
			return null
		}

		const errors: OverlayError[] = []
		for (const hookError of hook_errors(pipelineError)) {
			for (const loc of hookError.locations) {
				if (loc.filepath !== target.rel && loc.filepath !== target.abs) continue
				errors.push({ message: hookError.message, line: loc.line, column: loc.column })
			}
		}
		return errors
	})
}
