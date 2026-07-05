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
	if (serverPath) {
		startClient(serverPath, context)
		return
	}

	// no server in the project yet: offer the install, and start automatically the
	// moment the binary appears — whether it came from our button or their terminal
	offerInstall(workspaceRoot)
	watchForServer(workspaceRoot, context)
}

export function deactivate(): Thenable<void> | undefined {
	return client?.stop()
}

function startClient(serverPath: string, context: vscode.ExtensionContext) {
	const serverOptions: ServerOptions = {
		command: serverPath,
		transport: TransportKind.stdio,
	}

	// keep the server's database in sync with changes that never pass through the
	// editor (git checkouts, codegen runs, config edits)
	const watchers = [
		vscode.workspace.createFileSystemWatcher('**/houdini.config.{js,ts,mjs,cjs}'),
		vscode.workspace.createFileSystemWatcher('**/*.{gql,graphql}'),
		vscode.workspace.createFileSystemWatcher('**/*.{ts,tsx,js,jsx,svelte}'),
	]
	context.subscriptions.push(...watchers)

	const clientOptions: LanguageClientOptions = {
		documentSelector: [
			{ scheme: 'file', language: 'graphql' },
			{ scheme: 'file', language: 'typescript' },
			{ scheme: 'file', language: 'typescriptreact' },
			{ scheme: 'file', language: 'javascript' },
			{ scheme: 'file', language: 'javascriptreact' },
			{ scheme: 'file', language: 'svelte' },
		],
		synchronize: { fileEvents: watchers },
		workspaceFolder: vscode.workspace.workspaceFolders?.[0],
		outputChannelName: 'Houdini GraphQL',
	}

	client = new LanguageClient('houdini-graphql', 'Houdini GraphQL', serverOptions, clientOptions)
	client.start()
	context.subscriptions.push(client)
}

// start the client as soon as houdini-lsp shows up in the project — a filesystem
// watcher for the common case, plus a poll for installs that land outside the
// workspace root (hoisted monorepos) where the watcher can't see. the poll is
// unbounded on purpose — the install takes as long as the network says it does,
// and the user may not run it until much later
function watchForServer(workspaceRoot: string, context: vscode.ExtensionContext) {
	let started = false

	const watcher = vscode.workspace.createFileSystemWatcher('**/node_modules/.bin/houdini-lsp*')
	context.subscriptions.push(watcher)
	const poll = setInterval(tryStart, 1000)
	context.subscriptions.push({ dispose: () => clearInterval(poll) })

	function tryStart() {
		if (started) return
		const serverPath = findLspBinary(workspaceRoot, context.extensionPath)
		if (!serverPath) return
		started = true
		watcher.dispose()
		clearInterval(poll)
		vscode.window.setStatusBarMessage('Houdini GraphQL: language server started', 5000)
		startClient(serverPath, context)
	}

	watcher.onDidCreate(tryStart)
	watcher.onDidChange(tryStart)
}

// the server ships with the project (so it always matches the project's houdini
// version) — when it's missing, offer to install it with the project's package manager
async function offerInstall(workspaceRoot: string) {
	const choice = await vscode.window.showWarningMessage(
		'Houdini GraphQL: houdini-lsp not found in this project. The language server ships with your project so it always matches your Houdini version.',
		'Add houdini-lsp'
	)
	if (choice !== 'Add houdini-lsp') return

	// detect the package manager from the nearest lockfile
	const commands: Array<[string, string]> = [
		['pnpm-lock.yaml', 'pnpm add -D houdini-lsp'],
		['bun.lockb', 'bun add -d houdini-lsp'],
		['bun.lock', 'bun add -d houdini-lsp'],
		['yarn.lock', 'yarn add -D houdini-lsp'],
		['package-lock.json', 'npm install --save-dev houdini-lsp'],
	]
	let command = 'npm install --save-dev houdini-lsp'
	let dir = workspaceRoot
	search: while (true) {
		for (const [lockfile, cmd] of commands) {
			if (fs.existsSync(path.join(dir, lockfile))) {
				command = cmd
				break search
			}
		}
		const parent = path.dirname(dir)
		if (parent === dir) break
		dir = parent
	}

	const terminal = vscode.window.createTerminal({ name: 'houdini', cwd: workspaceRoot })
	terminal.show()
	terminal.sendText(command)
	vscode.window.showInformationMessage(
		'Houdini GraphQL: the language server will start automatically once the install finishes.'
	)
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
