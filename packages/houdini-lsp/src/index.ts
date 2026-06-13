#!/usr/bin/env node
import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	TextDocumentSyncKind,
	DiagnosticSeverity,
	CompletionItemKind,
	type InitializeParams,
	type InitializeResult,
	type Diagnostic,
	type CompletionItem,
	type CompletionParams,
	type HoverParams,
	type DefinitionParams,
	type Location,
} from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as nodePath from 'node:path'
import {
	getAutocompleteSuggestions,
	getHoverInformation,
	getTokenAtPosition,
	Position as GQLPosition,
	type ContextToken,
} from 'graphql-language-service'
import { Kind } from 'graphql'
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
	fragment_arguments,
	fragment_type_fields,
	fragment_definition_location,
	list_names,
} from './db_query.js'
import type { GraphQLSchema } from 'graphql'

const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(TextDocument)

let compiler: CompilerProxy | null = null
let schema: GraphQLSchema | null = null
let db: Db | null = null
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
				triggerCharacters: ['@', '(', ' ', ':'],
				resolveProvider: false,
			},
			hoverProvider: true,
			definitionProvider: true,
		},
	}
})

async function setupCompiler() {
	const config = await get_config({ force_reload: true })

	const lspDb = nodePath.join(
		config.root_dir,
		config.config_file.runtimeDir ?? '.houdini',
		'lsp.db'
	)
	const [openedDb, dbFile] = await init_db(config, false, lspDb)
	db = openedDb

	compiler = await codegen_setup(config, 'development', db, dbFile)
	connection.console.log('[houdini-lsp] ready')
}

// Run pipeline through validation, rebuild schema, publish diagnostics.
async function validate(savedUri: string) {
	if (!compiler || !db) return

	connection.sendDiagnostics({ uri: savedUri, diagnostics: [] })

	try {
		await compiler.pipeline_lock(() => compiler!.run_pipeline({ through: 'AfterValidate' }))
		db.reload()
		schema = schema_from_db(db)
	} catch (err) {
		if (!(err instanceof PluginHookError)) {
			connection.console.error(`[houdini-lsp] pipeline error: ${err}`)
			return
		}

		const byUri = new Map<string, Diagnostic[]>()

		for (const hookError of err.errors) {
			if (hookError.locations.length === 0) {
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
					range: {
						start: { line, character: col },
						end: { line, character: col + 1 },
					},
					message: hookError.message,
					source: 'houdini',
				})
				byUri.set(fileUri, list)
			}
		}

		for (const [uri, diagnostics] of byUri) {
			connection.sendDiagnostics({ uri, diagnostics })
		}
	}
}

connection.onDidSaveTextDocument(async (params) => {
	await ready
	await validate(params.textDocument.uri)
})

// ── completions ───────────────────────────────────────────────────────────────

connection.onCompletion(async (params: CompletionParams): Promise<CompletionItem[]> => {
	await ready
	if (!schema || !db) return []

	const doc = documents.get(params.textDocument.uri)
	if (!doc) return []

	const text = doc.getText()
	const cursor = new GQLPosition(params.position.line, params.position.character)

	const token: ContextToken = getTokenAtPosition(text, cursor)
	const ctx = houdiniDirectiveContext(token.state)

	if (ctx) {
		return houdiniCompletions(ctx, db)
	}

	// Standard GraphQL completions via graphql-language-service
	const suggestions = getAutocompleteSuggestions(schema, text, cursor, token as any)
	return suggestions as CompletionItem[]
})

// ── hover ─────────────────────────────────────────────────────────────────────

connection.onHover(async (params: HoverParams) => {
	await ready
	if (!schema) return null

	const doc = documents.get(params.textDocument.uri)
	if (!doc) return null

	const text = doc.getText()
	const result = getHoverInformation(
		schema,
		text,
		new GQLPosition(params.position.line, params.position.character)
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

	const token = getTokenAtPosition(
		doc.getText(),
		new GQLPosition(params.position.line, params.position.character)
	)

	// Walk up to find a FragmentSpread node
	let s = token.state
	while (s) {
		if (s.kind === Kind.FRAGMENT_SPREAD && s.name) {
			const loc = fragment_definition_location(db, s.name)
			if (!loc) return null
			return {
				uri: pathToFileURL(loc.filepath).toString(),
				range: {
					start: { line: Math.max(0, loc.line - 1), character: loc.column },
					end: { line: Math.max(0, loc.line - 1), character: loc.column },
				},
			}
		}
		s = s.prevState as typeof s
	}

	return null
})

// ── Houdini directive context ─────────────────────────────────────────────────

type HoudiniCtx =
	| { kind: 'with'; fragmentName: string }
	| { kind: 'when' | 'when_not'; fragmentName: string }
	| { kind: 'arguments'; fragmentName: string }

function houdiniDirectiveContext(state: ContextToken['state']): HoudiniCtx | null {
	let s: ContextToken['state'] | null = state
	while (s) {
		if (s.kind === Kind.DIRECTIVE && s.name) {
			const name = s.name
			if (name === 'with' || name === 'when' || name === 'when_not' || name === 'arguments') {
				const fragmentName = findEnclosingFragmentName(s.prevState ?? null)
				if (!fragmentName) return null
				return { kind: name as HoudiniCtx['kind'], fragmentName }
			}
		}
		s = s.prevState ?? null
	}
	return null
}

function findEnclosingFragmentName(state: ContextToken['state'] | null): string | null {
	let s = state
	while (s) {
		if (
			(s.kind === Kind.FRAGMENT_SPREAD || s.kind === Kind.FRAGMENT_DEFINITION) &&
			s.name
		) {
			return s.name
		}
		s = s.prevState ?? null
	}
	return null
}

function houdiniCompletions(ctx: HoudiniCtx, db: Db): CompletionItem[] {
	switch (ctx.kind) {
		case 'with':
		case 'arguments': {
			const args = fragment_arguments(db, ctx.fragmentName)
			return args.map((a) => ({
				label: a.name,
				detail: a.type,
				kind: CompletionItemKind.Field,
				insertText: `${a.name}: `,
			}))
		}

		case 'when':
		case 'when_not': {
			const fields = fragment_type_fields(db, ctx.fragmentName)
			return fields.map((f) => ({
				label: f.name,
				detail: buildTypeLabel(f.type, f.type_modifiers),
				documentation: f.description ?? undefined,
				kind: CompletionItemKind.Field,
			}))
		}
	}
}

function buildTypeLabel(type: string, modifiers: string | null): string {
	if (!modifiers) return type
	const listDepth = (modifiers.match(/\]/g) ?? []).length
	return '['.repeat(listDepth) + type + modifiers
}

// ── boot ──────────────────────────────────────────────────────────────────────

documents.listen(connection)
connection.listen()
