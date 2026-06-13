#!/usr/bin/env node
import {
	createConnection,
	ProposedFeatures,
	TextDocumentSyncKind,
	DiagnosticSeverity,
	type InitializeParams,
	type InitializeResult,
	type Diagnostic,
} from 'vscode-languageserver/node'
import { fileURLToPath } from 'node:url'
import * as nodePath from 'node:path'
import {
	get_config,
	init_db,
	codegen_setup,
	PluginHookError,
	type CompilerProxy,
} from 'houdini/lib'

const connection = createConnection(ProposedFeatures.all)

let compiler: CompilerProxy | null = null
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
				openClose: false,
				save: { includeText: false },
				change: TextDocumentSyncKind.None,
			},
		},
	}
})

async function setupCompiler() {
	const config = await get_config({ force_reload: true })

	// Use an LSP-specific db so we don't stomp on the dev server's db
	const lspDb = nodePath.join(
		config.root_dir,
		config.config_file.runtimeDir ?? '.houdini',
		'lsp.db'
	)
	const [db, dbFile] = await init_db(config, false, lspDb)

	compiler = await codegen_setup(config, 'development', db, dbFile)
	connection.console.log('[houdini-lsp] ready')
}

connection.onDidSaveTextDocument(async (params) => {
	if (!ready) return
	await ready

	if (!compiler) return

	// Clear previous diagnostics for this file immediately
	connection.sendDiagnostics({ uri: params.textDocument.uri, diagnostics: [] })

	try {
		await compiler.pipeline_lock(() =>
			compiler!.run_pipeline({ through: 'AfterValidate' })
		)
	} catch (err) {
		if (!(err instanceof PluginHookError)) {
			connection.console.error(`[houdini-lsp] pipeline error: ${err}`)
			return
		}

		const byUri = new Map<string, Diagnostic[]>()

		for (const hookError of err.errors) {
			if (hookError.locations.length === 0) {
				// No location — attach to the saved file
				const list = byUri.get(params.textDocument.uri) ?? []
				list.push({
					severity: DiagnosticSeverity.Error,
					range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
					message: hookError.message,
					source: 'houdini',
				})
				byUri.set(params.textDocument.uri, list)
				continue
			}

			for (const loc of hookError.locations) {
				const fileUri = nodePath.isAbsolute(loc.filepath)
					? `file://${loc.filepath}`
					: `file://${nodePath.resolve(loc.filepath)}`

				// LSP positions are 0-based; Houdini errors use 1-based lines
				const line = Math.max(0, (loc.line ?? 1) - 1)
				const col = Math.max(0, (loc.column ?? 0))

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
})

connection.listen()
