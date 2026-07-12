import * as vscode from 'vscode'
import * as path from 'node:path'
import * as fs from 'node:fs'
import {
	LanguageClient,
	type LanguageClientOptions,
	type ServerOptions,
	TransportKind,
} from 'vscode-languageclient/node'

// one client (and one server process) per workspace folder — a multi-root
// workspace can hold several houdini projects, and each runs its own houdini-lsp
// so every project gets the server that matches its houdini version. the server
// side needs nothing special for this: a server is per-project by construction
// (own cwd, own lsp.db, own compiler).
const clients = new Map<string, LanguageClient>()

export function activate(context: vscode.ExtensionContext) {
	for (const folder of vscode.workspace.workspaceFolders ?? []) {
		considerFolder(folder, context)
	}

	context.subscriptions.push(
		vscode.workspace.onDidChangeWorkspaceFolders((event) => {
			for (const folder of event.added) {
				considerFolder(folder, context)
			}
			for (const folder of event.removed) {
				const key = folder.uri.toString()
				const client = clients.get(key)
				if (client) {
					clients.delete(key)
					void client.stop()
				}
			}
		})
	)
}

export function deactivate(): Thenable<void> | undefined {
	const stopping = [...clients.values()].map((client) => client.stop())
	clients.clear()
	return Promise.all(stopping).then(() => undefined)
}

// start a client for the folder when its server is already installed; otherwise,
// if the folder is a houdini project, offer the install and start the moment the
// binary appears — whether it came from our button or their terminal. folders
// that are neither are other residents of the workspace and are left alone.
function considerFolder(folder: vscode.WorkspaceFolder, context: vscode.ExtensionContext) {
	if (clients.has(folder.uri.toString())) return

	const serverPath = findLspBinary(folder.uri.fsPath, context.extensionPath)
	if (serverPath) {
		startClient(folder, serverPath, context)
		return
	}

	if (!hasHoudiniConfig(folder.uri.fsPath)) return
	offerInstall(folder)
	watchForServer(folder, context)
}

function hasHoudiniConfig(root: string): boolean {
	return ['js', 'ts', 'mjs', 'cjs'].some((ext) =>
		fs.existsSync(path.join(root, `houdini.config.${ext}`))
	)
}

function startClient(
	folder: vscode.WorkspaceFolder,
	serverPath: string,
	context: vscode.ExtensionContext
) {
	// the extension development host's launch config sets HOUDINI_LSP_INSPECT so a node attach
	// config can debug the server; the bin script runs under `env node`, so NODE_OPTIONS
	// reaches it. (an inspect port can only be bound once, so dev-host workspaces
	// are expected to be single-folder.)
	const inspect = process.env.HOUDINI_LSP_INSPECT
	const serverOptions: ServerOptions = {
		command: serverPath,
		transport: TransportKind.stdio,
		...(inspect
			? { options: { env: { ...process.env, NODE_OPTIONS: `--inspect=${inspect}` } } }
			: {}),
	}

	// file watching is registered dynamically by the server (it needs the events to
	// keep its database in sync with git checkouts, codegen runs, and config edits),
	// so no client-side watchers here: the same mechanism serves every editor.
	// every selector is scoped to the folder so a document in one project never
	// reaches another project's server.
	const pattern = `${folder.uri.fsPath.replaceAll('\\', '/')}/**`
	const clientOptions: LanguageClientOptions = {
		documentSelector: [
			'graphql',
			'typescript',
			'typescriptreact',
			'javascript',
			'javascriptreact',
			'svelte',
		].map((language) => ({ scheme: 'file', language, pattern })),
		workspaceFolder: folder,
		outputChannelName:
			(vscode.workspace.workspaceFolders?.length ?? 1) > 1
				? `Houdini GraphQL (${folder.name})`
				: 'Houdini GraphQL',
	}

	const client = new LanguageClient(
		'houdini-graphql',
		clientOptions.outputChannelName!,
		serverOptions,
		clientOptions
	)
	clients.set(folder.uri.toString(), client)
	client.start()
}

// start the folder's client as soon as houdini-lsp shows up — a filesystem
// watcher for the common case, plus a poll for installs that land outside the
// folder (hoisted monorepos) where the watcher can't see
function watchForServer(folder: vscode.WorkspaceFolder, context: vscode.ExtensionContext) {
	let started = false

	const watcher = vscode.workspace.createFileSystemWatcher(
		new vscode.RelativePattern(folder, '**/node_modules/.bin/houdini-lsp*')
	)
	context.subscriptions.push(watcher)
	const poll = setInterval(tryStart, 500)
	context.subscriptions.push({ dispose: () => clearInterval(poll) })
	// the poll only exists for installs that land outside the folder (hoisted
	// monorepos) where the watcher can't see — stop it after 15 minutes so a
	// session that never installs isn't stat-ing the disk forever. the watcher
	// stays armed for in-folder installs at any time.
	const pollDeadline = setTimeout(() => clearInterval(poll), 15 * 60 * 1000)
	context.subscriptions.push({ dispose: () => clearTimeout(pollDeadline) })

	function tryStart() {
		if (started || clients.has(folder.uri.toString())) return
		// the folder may have left the workspace while we waited for the install
		if (!vscode.workspace.getWorkspaceFolder(folder.uri)) {
			watcher.dispose()
			clearInterval(poll)
			return
		}
		const serverPath = findLspBinary(folder.uri.fsPath, context.extensionPath)
		if (!serverPath) return
		started = true
		watcher.dispose()
		clearInterval(poll)
		vscode.window.setStatusBarMessage('Houdini GraphQL: language server started', 5000)
		startClient(folder, serverPath, context)
	}

	watcher.onDidCreate(tryStart)
	watcher.onDidChange(tryStart)
}

// the server ships with the project (so it always matches the project's houdini
// version) — when it's missing, offer to install it with the project's package manager
async function offerInstall(folder: vscode.WorkspaceFolder) {
	const workspaceRoot = folder.uri.fsPath
	const choice = await vscode.window.showWarningMessage(
		`Houdini GraphQL: houdini-lsp not found in ${folder.name}. The language server ships with your project so it always matches your Houdini version.`,
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

	// Walk up from the folder root so we find the bin regardless of whether
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
