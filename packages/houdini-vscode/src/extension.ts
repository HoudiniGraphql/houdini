import * as vscode from 'vscode'
import * as path from 'node:path'
import * as fs from 'node:fs'
import {
	LanguageClient,
	type LanguageClientOptions,
	type ServerOptions,
	TransportKind,
} from 'vscode-languageclient/node'

let client: LanguageClient | undefined

export function activate(context: vscode.ExtensionContext) {
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
	if (!workspaceRoot) return

	const serverPath = findLspBinary(workspaceRoot)
	if (!serverPath) {
		vscode.window.showWarningMessage(
			'Houdini GraphQL: houdini-lsp not found. Add houdini-lsp to your devDependencies.'
		)
		return
	}

	const serverOptions: ServerOptions = {
		command: serverPath,
		transport: TransportKind.stdio,
	}

	const clientOptions: LanguageClientOptions = {
		documentSelector: [
			{ scheme: 'file', language: 'graphql' },
			{ scheme: 'file', language: 'typescript' },
			{ scheme: 'file', language: 'typescriptreact' },
			{ scheme: 'file', language: 'javascript' },
			{ scheme: 'file', language: 'javascriptreact' },
			{ scheme: 'file', language: 'svelte' },
		],
		workspaceFolder: vscode.workspace.workspaceFolders?.[0],
		outputChannelName: 'Houdini GraphQL',
	}

	client = new LanguageClient('houdini-graphql', 'Houdini GraphQL', serverOptions, clientOptions)
	client.start()
	context.subscriptions.push(client)
}

export function deactivate(): Thenable<void> | undefined {
	return client?.stop()
}

function findLspBinary(workspaceRoot: string): string | null {
	// Prefer the project-local install so the binary version matches houdini
	const isWindows = process.platform === 'win32'
	const binName = isWindows ? 'houdini-lsp.cmd' : 'houdini-lsp'
	const localBin = path.join(workspaceRoot, 'node_modules', '.bin', binName)
	if (fs.existsSync(localBin)) return localBin

	// Also check pnpm's .bin location one level up (monorepo root)
	const parentBin = path.join(workspaceRoot, '..', 'node_modules', '.bin', binName)
	if (fs.existsSync(parentBin)) return parentBin

	return null
}
