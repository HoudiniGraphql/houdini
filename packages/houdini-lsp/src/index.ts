#!/usr/bin/env node
// The Houdini language server: a thin LSP shell over the compiler pipeline.
// The compiler's database is the brain — completions, hover, definitions, and
// diagnostics all read from it, and live validation runs the real pipeline
// against buffer overlays. See:
//   state.ts       shared server state + schema reconstruction
//   lifecycle.ts   startup, restarts, watched files, shutdown
//   diagnostics.ts pipeline validation from disk (save / reconciliation)
//   overlay.ts     live validation (fast pass + buffer overlay)
//   handlers.ts    completion / hover / definition

import { fileURLToPath } from 'node:url'
import {
	createConnection,
	ProposedFeatures,
	TextDocuments,
	TextDocumentSyncKind,
	type InitializeParams,
	type InitializeResult,
} from 'vscode-languageserver/node.js'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { register_save_validation } from './diagnostics.js'
import { register_handlers } from './handlers.js'
import { register_lifecycle, setup_compiler } from './lifecycle.js'
import { register_live_validation } from './overlay.js'
import { create_state } from './state.js'

const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(TextDocument)
const state = create_state(connection, documents)

connection.onInitialize((params: InitializeParams): InitializeResult => {
	const rootUri = params.rootUri ?? params.workspaceFolders?.[0]?.uri
	if (rootUri) {
		process.chdir(fileURLToPath(rootUri))
	}

	state.ready = setup_compiler(state).catch((err: Error) => {
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

register_handlers(state)
register_save_validation(state)
register_live_validation(state)
register_lifecycle(state)

documents.listen(connection)
connection.listen()
