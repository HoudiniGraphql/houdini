// Pipeline validation from disk state: runs on save (scoped reset of the saved
// file) and on watched-file changes (full reconciliation), publishing diagnostics
// to every affected file. Live-path diagnostics (overlay.ts) are tracked per uri
// and merged in, so a full run never wipes another file's live squiggles.

import { PluginHookError } from 'houdini/lib'
import { readFileSync } from 'node:fs'
import * as nodePath from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DiagnosticSeverity, type Diagnostic } from 'vscode-languageserver/node.js'

import { extract_blocks, identifier_range, type Block } from './extract.js'
import { rebuild_schema, type ServerState } from './state.js'

// blow away a file's raw documents and patch up spreads before re-extraction —
// re-extraction inserts next to previous rows instead of replacing them (same
// protocol as the HMR handler in vite/hmr.ts)
export function reset_file_documents(state: ServerState, abs: string) {
	const db = state.db
	if (!db) return
	const rel = nodePath.relative(state.root_dir, abs)
	db.run(`DELETE FROM raw_documents WHERE filepath = ? OR filepath = ?`, [abs, rel])
	db.run(`
		UPDATE selections AS s
		SET field_name = s.fragment_ref
		WHERE s.fragment_ref IS NOT NULL
		  AND s.kind = 'fragment'
		  AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.name = s.field_name)
	`)
	db.run(`
		WITH orphan_selections AS (
		  SELECT s.id FROM selections s
		  LEFT JOIN selection_refs rp ON rp.parent_id = s.id
		  LEFT JOIN selection_refs rc ON rc.child_id = s.id
		  WHERE rp.id IS NULL AND rc.id IS NULL
		)
		DELETE FROM selections WHERE id IN (SELECT id FROM orphan_selections)
	`)
}

// the text a diagnostic's file currently has: the open buffer when we have one,
// the on-disk content otherwise (used to widen point locations over identifiers)
function file_text(state: ServerState, fileUri: string): string | undefined {
	const open = state.documents.get(fileUri)
	if (open) return open.getText()
	try {
		return readFileSync(fileURLToPath(fileUri), 'utf-8')
	} catch {
		return undefined
	}
}

// The pipeline adds a document's column offset to every error line, but the offset
// only applies to the document's first line (content starts mid-line only there).
// Undo it for subsequent lines so inline template errors land on the right column,
// then widen the point over the identifier under it.
export function pipeline_range(
	text: string | undefined,
	blocks: Block[],
	line: number,
	column: number
) {
	for (const block of blocks) {
		const endLine = block.offsetLine + block.content.split('\n').length - 1
		if (line >= block.offsetLine && line <= endLine) {
			if (line > block.offsetLine) {
				column = Math.max(0, column - block.offsetColumn)
			}
			break
		}
	}
	return identifier_range(text, line, column)
}

// the errors a PluginHookError carries (houdini/lib ships no declarations, so
// verify the shape at runtime instead of trusting a cast)
export type HookErrorShape = {
	message: string
	locations: Array<{ filepath: string; line: number | null; column: number | null }>
}
export function hook_errors(err: unknown): HookErrorShape[] {
	const errors = (err as { errors?: unknown }).errors
	return Array.isArray(errors) ? (errors as HookErrorShape[]) : []
}

export { PluginHookError }

// a file's full diagnostic set: the live-path squiggles it already has plus the
// pipeline's, deduplicated (the same underlying error can surface in both)
function merged_diagnostics(state: ServerState, uri: string, pipeline: Diagnostic[]): Diagnostic[] {
	const live = state.live_diagnostics.get(uri) ?? []
	const seen = new Set(
		live.map((d) => `${d.message}@${d.range.start.line}:${d.range.start.character}`)
	)
	return [
		...live,
		...pipeline.filter(
			(d) => !seen.has(`${d.message}@${d.range.start.line}:${d.range.start.character}`)
		),
	]
}

// Run the pipeline through validation, rebuild the schema, publish diagnostics.
// The whole reset → clear → run → publish sequence runs inside pipeline_lock (the
// same discipline as run_overlay in overlay.ts): letting two validates interleave
// would race one run's publishes against the other's clears. The lock is a plain
// promise chain, so nothing in here may call pipeline_lock again.
export async function validate(state: ServerState, savedUri?: string) {
	const { connection, db, compiler } = state
	if (!compiler || !db) return

	if (savedUri) {
		// the pipeline result supersedes the live squiggles for the saved file
		state.live_diagnostics.delete(savedUri)
		connection.sendDiagnostics({ uri: savedUri, diagnostics: [] })
	}

	await compiler.pipeline_lock(async () => {
		if (savedUri) {
			try {
				db.transaction(() => reset_file_documents(state, fileURLToPath(savedUri)))
				db.flush()
			} catch (err) {
				connection.console.error(`[houdini-lsp] failed to reset saved file: ${err}`)
			}
		}

		// clear the previous run's diagnostics down to whatever the live path still shows
		for (const uri of state.pipeline_diagnostic_uris) {
			connection.sendDiagnostics({
				uri,
				diagnostics: state.live_diagnostics.get(uri) ?? [],
			})
		}
		state.pipeline_diagnostic_uris = new Set()

		let pipelineError: unknown = null
		try {
			await compiler.run_pipeline({ through: 'AfterValidate' })
		} catch (err) {
			pipelineError = err
		}

		// the schema steps run before validation, so the schema tables are populated
		// even when validation fails — always rebuild
		try {
			rebuild_schema(state)
		} catch (err) {
			connection.console.error(`[houdini-lsp] failed to rebuild schema: ${err}`)
		}

		if (!pipelineError) return
		if (!(pipelineError instanceof PluginHookError)) {
			connection.console.error(`[houdini-lsp] pipeline error: ${pipelineError}`)
			return
		}

		const byUri = new Map<string, Diagnostic[]>()
		// cache per-file extraction — error-dense files report many locations
		const blocks_by_uri = new Map<string, { text: string | undefined; blocks: Block[] }>()

		for (const hookError of hook_errors(pipelineError)) {
			if (hookError.locations.length === 0) {
				if (!savedUri) {
					// nowhere to anchor it — at least surface it in the output channel
					connection.console.error(`[houdini-lsp] ${hookError.message}`)
					continue
				}
				const list = byUri.get(savedUri) ?? []
				list.push({
					severity: DiagnosticSeverity.Error,
					range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
					message: hookError.message,
					source: 'houdini',
				})
				byUri.set(savedUri, list)
				continue
			}

			for (const loc of hookError.locations) {
				const fileUri = nodePath.isAbsolute(loc.filepath)
					? pathToFileURL(loc.filepath).toString()
					: pathToFileURL(nodePath.resolve(loc.filepath)).toString()

				const line = Math.max(0, (loc.line ?? 1) - 1)
				const col = Math.max(0, loc.column ?? 0)

				let cached = blocks_by_uri.get(fileUri)
				if (!cached) {
					const text = file_text(state, fileUri)
					cached = { text, blocks: text ? extract_blocks(text, fileUri) : [] }
					blocks_by_uri.set(fileUri, cached)
				}

				const list = byUri.get(fileUri) ?? []
				list.push({
					severity: DiagnosticSeverity.Error,
					range: pipeline_range(cached.text, cached.blocks, line, col),
					message: hookError.message,
					source: 'houdini',
				})
				byUri.set(fileUri, list)
			}
		}

		for (const [uri, diagnostics] of byUri) {
			connection.sendDiagnostics({
				uri,
				diagnostics: merged_diagnostics(state, uri, diagnostics),
			})
			state.pipeline_diagnostic_uris.add(uri)
		}
	})
}

// validate on save — the pipeline result supersedes any pending live validation
// for the file. subscribed through the documents manager: documents.listen()
// registers its own connection-level didSave handler, which would clobber
// connection.onDidSaveTextDocument
export function register_save_validation(state: ServerState) {
	state.documents.onDidSave(async (event) => {
		await state.ready
		const timer = state.live_timers.get(event.document.uri)
		if (timer) {
			clearTimeout(timer)
			state.live_timers.delete(event.document.uri)
		}
		await validate(state, event.document.uri)
	})
}
