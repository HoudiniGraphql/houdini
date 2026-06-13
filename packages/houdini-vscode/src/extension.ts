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

	const serverPath = findLspBinary(workspaceRoot, context.extensionPath)
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

function findLspBinary(workspaceRoot: string, extensionPath: string): string | null {
	const isWindows = process.platform === 'win32'
	const binName = isWindows ? 'houdini-lsp.cmd' : 'houdini-lsp'

	// Check the extension's own node_modules first (covers the dep-bundled case
	// and the development host where houdini-vscode depends on houdini-lsp).
	const extBin = path.join(extensionPath, 'node_modules', '.bin', binName)
	if (fs.existsSync(extBin)) return extBin

	// Walk up from the workspace root so we find the bin regardless of whether
	// houdini-lsp is installed locally or hoisted to a monorepo root.
	let dir = workspaceRoot
	while (true) {
		const candidate = path.join(dir, 'node_modules', '.bin', binName)
		if (fs.existsSync(candidate)) return candidate
		const parent = path.dirname(dir)
		if (parent === dir) break
		dir = parent
	}

	return null
}
