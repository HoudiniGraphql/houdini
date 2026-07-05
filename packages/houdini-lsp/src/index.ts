#!/usr/bin/env node
import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	TextDocumentSyncKind,
	DiagnosticSeverity,
	type InitializeParams,
	type InitializeResult,
	type Diagnostic,
	type CompletionItem,
	type CompletionParams,
	type HoverParams,
	type DefinitionParams,
	type Location,
} from 'vscode-languageserver/node.js'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
import * as nodePath from 'node:path'
import {
	getAutocompleteSuggestions,
	getHoverInformation,
	getTokenAtPosition,
	Position as GQLPosition,
	type ContextToken,
} from 'graphql-language-service'
import { Kind, Source, parse, type FragmentDefinitionNode } from 'graphql'
import {
	get_config,
	init_db,
	codegen_setup,
	PluginHookError,
	type CompilerProxy,
	type Db,
} from 'houdini/lib'
import { schema_from_db } from './schema_from_db.js'
import {
	all_fragment_arguments,
	all_list_field_arguments,
	fragment_definition_location,
	project_fragments,
} from './db_query.js'
import {
	extract_blocks,
	block_at,
	identifier_range,
	to_local,
	type Block,
	type Position,
} from './extract.js'
import { validate_block, type HoudiniArgKnowledge } from './validation.js'
import {
	definition_position,
	houdiniCompletions,
	houdiniDirectiveContext,
	in_arguments,
	required_first,
} from './completions.js'
import type { GraphQLSchema } from 'graphql'

const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(TextDocument)

let compiler: CompilerProxy | null = null
let schema: GraphQLSchema | null = null
let db: Db | null = null
let external_fragments: FragmentDefinitionNode[] = []
let houdini_args: HoudiniArgKnowledge = { fragments: new Map(), lists: new Map() }
let root_dir = ''
let ready: Promise<void>

connection.onInitialize((params: InitializeParams): InitializeResult => {
	const rootUri = params.rootUri ?? params.workspaceFolders?.[0]?.uri
	if (rootUri) {
		process.chdir(fileURLToPath(rootUri))
	}

	ready = setupCompiler().catch((err: Error) => {
		connection.console.error(`[houdini-lsp] failed to initialize: ${err.message}`)
	})

	return {
		capabilities: {
			textDocumentSync: {
				openClose: true,
				save: { includeText: false },
				change: TextDocumentSyncKind.Full,
			},
			completionProvider: {
				triggerCharacters: ['@', '(', ' ', ':', '.'],
				resolveProvider: false,
			},
			hoverProvider: true,
			definitionProvider: true,
		},
	}
})

async function setupCompiler() {
	const config = await get_config({ force_reload: true })
	root_dir = config.root_dir

	const lspDb = nodePath.join(
		config.root_dir,
		config.config_file.runtimeDir ?? '.houdini',
		'lsp.db'
	)
	const [openedDb, dbFile] = await init_db(config, false, lspDb)
	db = openedDb

	compiler = await codegen_setup(config, 'development', db, dbFile)

	// run the pipeline once so the schema and fragment list are live before the
	// first save — completions and hover work as soon as the editor opens
	await validate()

	connection.console.log('[houdini-lsp] ready')
}

// rebuild the in-memory schema and fragment stubs from whatever the pipeline last wrote
function rebuild_schema() {
	if (!db) return
	db.reload()
	schema = schema_from_db(db)
	external_fragments = load_external_fragments(db)
	houdini_args = {
		fragments: all_fragment_arguments(db),
		lists: all_list_field_arguments(db),
	}
}

// stub definitions for every project fragment so spreads resolve in completions and
// validation without concatenating full document sources
function load_external_fragments(current: Db): FragmentDefinitionNode[] {
	const text = project_fragments(current)
		.map((f) => `fragment ${f.name} on ${f.type_condition} { __typename }`)
		.join('\n')
	if (!text) return []
	try {
		return parse(new Source(text, 'houdini-project-fragments')).definitions.filter(
			(d): d is FragmentDefinitionNode => d.kind === Kind.FRAGMENT_DEFINITION
		)
	} catch {
		return []
	}
}

// ── pipeline validation (on save) ─────────────────────────────────────────────

// blow away a file's raw documents and patch up spreads before re-extraction
function reset_file_documents(abs: string) {
	if (!db) return
	const rel = nodePath.relative(root_dir, abs)
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
function file_text(fileUri: string): string | undefined {
	const open = documents.get(fileUri)
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
function pipeline_range(
	text: string | undefined,
	path: string,
	line: number,
	column: number
) {
	if (text) {
		for (const block of extract_blocks(text, path)) {
			const endLine = block.offsetLine + block.content.split('\n').length - 1
			if (line >= block.offsetLine && line <= endLine) {
				if (line > block.offsetLine) {
					column = Math.max(0, column - block.offsetColumn)
				}
				break
			}
		}
	}
	return identifier_range(text, line, column)
}

// the errors a PluginHookError carries (houdini/lib ships no declarations)
type HookErrorShape = {
	message: string
	locations: Array<{ filepath: string; line: number | null; column: number | null }>
}
const hook_errors = (err: unknown) => (err as { errors: HookErrorShape[] }).errors

// files we last published pipeline diagnostics to, so stale ones clear on the next run
let pipeline_diagnostic_uris = new Set<string>()

// Run the pipeline through validation, rebuild the schema, publish diagnostics.
async function validate(savedUri?: string) {
	if (!compiler || !db) return

	for (const uri of pipeline_diagnostic_uris) {
		connection.sendDiagnostics({ uri, diagnostics: [] })
	}
	pipeline_diagnostic_uris = new Set()
	if (savedUri) {
		connection.sendDiagnostics({ uri: savedUri, diagnostics: [] })

		// re-extraction doesn't replace a file's previous documents, it inserts next
		// to them (same protocol as the HMR handler in vite/hmr.ts): blow away the
		// saved file's raw documents and patch up spreads before the pipeline runs
		try {
			db.transaction(() => reset_file_documents(fileURLToPath(savedUri)))
			db.flush()
		} catch (err) {
			connection.console.error(`[houdini-lsp] failed to reset saved file: ${err}`)
		}
	}

	let pipelineError: unknown = null
	try {
		await compiler.pipeline_lock(() => compiler!.run_pipeline({ through: 'AfterValidate' }))
	} catch (err) {
		pipelineError = err
	}

	// the schema steps run before validation, so the schema tables are populated
	// even when validation fails — always rebuild
	try {
		rebuild_schema()
	} catch (err) {
		connection.console.error(`[houdini-lsp] failed to rebuild schema: ${err}`)
	}

	if (!pipelineError) return
	if (!(pipelineError instanceof PluginHookError)) {
		connection.console.error(`[houdini-lsp] pipeline error: ${pipelineError}`)
		return
	}

	const byUri = new Map<string, Diagnostic[]>()

	for (const hookError of hook_errors(pipelineError)) {
		if (hookError.locations.length === 0) {
			if (!savedUri) continue
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

			const list = byUri.get(fileUri) ?? []
			list.push({
				severity: DiagnosticSeverity.Error,
				range: pipeline_range(file_text(fileUri), fileUri, line, col),
				message: hookError.message,
				source: 'houdini',
			})
			byUri.set(fileUri, list)
		}
	}

	for (const [uri, diagnostics] of byUri) {
		connection.sendDiagnostics({ uri, diagnostics })
		pipeline_diagnostic_uris.add(uri)
	}
}

// subscribe through the documents manager — documents.listen() registers its own
// connection-level didSave handler, which would clobber connection.onDidSaveTextDocument
documents.onDidSave(async (event) => {
	await ready
	// the pipeline result supersedes any pending live validation for this file
	const timer = live_timers.get(event.document.uri)
	if (timer) {
		clearTimeout(timer)
		live_timers.delete(event.document.uri)
	}
	await validate(event.document.uri)
})

// ── live validation (as you type) ─────────────────────────────────────────────

const live_timers = new Map<string, ReturnType<typeof setTimeout>>()

documents.onDidChangeContent((event) => {
	const uri = event.document.uri
	const timer = live_timers.get(uri)
	if (timer) clearTimeout(timer)
	live_timers.set(
		uri,
		setTimeout(async () => {
			live_timers.delete(uri)
			await ready
			live_validate(event.document)
		}, 250)
	)
})

async function live_validate(doc: TextDocument) {
	if (!schema) return
	// never let a validation failure (eg an invalid reconstructed schema) take the
	// whole server down — this runs in a timer, so a throw here is fatal
	try {
		const version = doc.version
		const blocks = extract_blocks(doc.getText(), doc.uri)

		// fast pass: syntax errors + @with/@when argument checks, published
		// immediately without a pipeline round trip
		const fast = blocks.flatMap((block) => validate_block(schema!, block, houdini_args))
		connection.sendDiagnostics({ uri: doc.uri, diagnostics: fast })

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

		const overlay = await overlay_validate(doc, blocks)
		if (overlay === null) return // overlay failed — keep the fast diagnostics
		// the buffer moved on while the pipeline ran; a newer pass owns publishing
		if (documents.get(doc.uri)?.version !== version) return

		connection.sendDiagnostics({ uri: doc.uri, diagnostics: [...fast, ...overlay] })
	} catch (err) {
		connection.console.error(`[houdini-lsp] live validation failed: ${err}`)
	}
}

// ── pipeline overlay (as you type, authoritative) ─────────────────────────────

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

// Validate the buffer with the real compiler: replace the file's documents with
// rows extracted from the buffer (marked with a task id), run the pipeline from
// extraction through validation scoped to that task, and return the errors anchored
// in this file. The lsp database deliberately tracks buffer state, not disk state —
// the on-save pass reconciles from disk.
async function overlay_validate(
	doc: TextDocument,
	blocks: Block[]
): Promise<Diagnostic[] | null> {
	if (!compiler || !db) return null

	const abs = fileURLToPath(doc.uri)
	const rel = nodePath.relative(root_dir, abs)
	const task_id = `lsp-overlay-${++overlay_counter}`

	return compiler.pipeline_lock(async () => {
		if (!compiler || !db) return null

		try {
			db.transaction(() => {
				reset_file_documents(abs)
				for (const block of blocks) {
					db!.run(
						`INSERT INTO raw_documents (filepath, content, offset_column, offset_line, current_task)
						 VALUES (?, ?, ?, ?, ?)`,
						[rel, block.content, block.offsetColumn, block.offsetLine, task_id]
					)
					if (block.prop) {
						const raw = db!.get<{ id: number }>(`SELECT last_insert_rowid() AS id`)
						if (raw) {
							db!.run(
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
			await compiler.run_pipeline({ task_id, after: 'AfterExtract', through: 'AfterValidate' })
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
			rebuild_schema()
		} catch (err) {
			connection.console.error(`[houdini-lsp] failed to rebuild schema: ${err}`)
		}

		if (!pipelineError) return []
		if (!(pipelineError instanceof PluginHookError)) {
			connection.console.error(`[houdini-lsp] overlay validation error: ${pipelineError}`)
			return null
		}

		// keep only errors anchored in this file — cross-file fallout from an
		// unsaved buffer is reported on save
		const text = doc.getText()
		const diagnostics: Diagnostic[] = []
		for (const hookError of hook_errors(pipelineError)) {
			for (const loc of hookError.locations) {
				if (loc.filepath !== rel && loc.filepath !== abs) continue
				diagnostics.push({
					severity: DiagnosticSeverity.Error,
					range: pipeline_range(
						text,
						doc.uri,
						Math.max(0, (loc.line ?? 1) - 1),
						Math.max(0, loc.column ?? 0)
					),
					message: hookError.message,
					source: 'houdini',
				})
			}
		}
		return diagnostics
	})
}

// ── completions ───────────────────────────────────────────────────────────────

connection.onCompletion(async (params: CompletionParams): Promise<CompletionItem[]> => {
	await ready
	if (!schema || !db) return []

	const doc = documents.get(params.textDocument.uri)
	if (!doc) return []

	const located = locate(doc, params.position)
	if (!located) return []
	const { block, local } = located

	const cursor = new GQLPosition(local.line, local.character)
	// offset 1 = the token ending at the cursor. without it, a cursor at the end of
	// a line (the normal typing position) matches no token and the state collapses
	// to Document, which turns every completion into top-level keywords
	const token: ContextToken = getTokenAtPosition(block.content, cursor, 1)
	const ctx = houdiniDirectiveContext(token.state)

	if (ctx) {
		return houdiniCompletions(ctx, db)
	}

	// standard GraphQL completions, with project fragments available for spreads
	const suggestions = getAutocompleteSuggestions(
		schema,
		block.content,
		cursor,
		token as any,
		external_fragments
	)

	// a fragment defined in this block also exists as an external stub — dedupe
	const seen = new Set<string>()
	const items = (suggestions as CompletionItem[]).filter((s) => {
		if (seen.has(s.label)) return false
		seen.add(s.label)
		return true
	})

	return in_arguments(token.state) ? required_first(items) : items
})

// ── hover ─────────────────────────────────────────────────────────────────────

connection.onHover(async (params: HoverParams) => {
	await ready
	if (!schema) return null

	const doc = documents.get(params.textDocument.uri)
	if (!doc) return null

	const located = locate(doc, params.position)
	if (!located) return null
	const { block, local } = located

	const result = getHoverInformation(
		schema,
		block.content,
		new GQLPosition(local.line, local.character)
	)
	if (!result || result === '') return null

	return {
		contents: typeof result === 'string' ? { kind: 'markdown', value: result } : result,
	}
})

// ── definition ────────────────────────────────────────────────────────────────

connection.onDefinition(async (params: DefinitionParams): Promise<Location | null> => {
	await ready
	if (!db) return null

	const doc = documents.get(params.textDocument.uri)
	if (!doc) return null

	const located = locate(doc, params.position)
	if (!located) return null
	const { block, local } = located

	const token = getTokenAtPosition(
		block.content,
		new GQLPosition(local.line, local.character),
		1
	)

	// Walk up to find a FragmentSpread node
	let s = token.state
	while (s) {
		if (s.kind === Kind.FRAGMENT_SPREAD && s.name) {
			const loc = fragment_definition_location(db, s.name)
			if (!loc) return null
			const position = definition_position(loc, s.name)
			return {
				uri: pathToFileURL(loc.filepath).toString(),
				range: { start: position, end: position },
			}
		}
		s = s.prevState as typeof s
	}

	return null
})

// ── inline document lookup ────────────────────────────────────────────────────

function locate(
	doc: TextDocument,
	position: Position
): { block: Block; local: Position } | null {
	const block = block_at(extract_blocks(doc.getText(), doc.uri), position)
	if (!block) return null
	return { block, local: to_local(block, position) }
}

// ── watched files ─────────────────────────────────────────────────────────────
// the database otherwise only learns about changes through the editor: a git
// checkout, a codegen run, or a config edit would leave it stale until some save

let watch_timer: ReturnType<typeof setTimeout> | null = null
let watch_restart = false

connection.onDidChangeWatchedFiles(async (params) => {
	await ready

	let relevant = false
	for (const change of params.changes) {
		const base = nodePath.basename(fileURLToPath(change.uri))
		if (base.startsWith('houdini.config.')) {
			watch_restart = true
			relevant = true
			continue
		}
		// open documents reconcile through didSave and live validation
		if (documents.get(change.uri)) continue
		relevant = true
	}
	if (!relevant) return

	// coalesce bursts (git checkout touches many files at once)
	if (watch_timer) clearTimeout(watch_timer)
	watch_timer = setTimeout(async () => {
		watch_timer = null
		const restart = watch_restart
		watch_restart = false
		try {
			if (restart) {
				await restart_compiler()
			} else {
				// a full run re-walks the project: new files load, deleted files'
				// rows are cleaned up, and the schema file is re-read
				await validate()
			}
		} catch (err) {
			connection.console.error(`[houdini-lsp] watched-file reconciliation failed: ${err}`)
		}
	}, 500)
})

async function restart_compiler() {
	connection.console.log('[houdini-lsp] config changed — restarting pipeline')
	await teardown()
	ready = setupCompiler().catch((err: Error) => {
		connection.console.error(`[houdini-lsp] failed to restart: ${err.message}`)
	})
	await ready
}

// ── lifecycle ─────────────────────────────────────────────────────────────────

// tear down the pipeline (config server + plugin processes) so editor reloads
// don't leak Go processes
async function teardown() {
	for (const timer of live_timers.values()) {
		clearTimeout(timer)
	}
	live_timers.clear()

	const active = compiler
	compiler = null
	schema = null
	try {
		await active?.close()
	} catch {}
	try {
		db?.close()
	} catch {}
	db = null
}

connection.onShutdown(async () => {
	await teardown()
})

connection.onExit(() => {
	process.exit(0)
})

// ── boot ──────────────────────────────────────────────────────────────────────

documents.listen(connection)
connection.listen()
