import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, lstatSync, readdirSync, readFileSync, readlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { snapshot } from '@webcontainer/snapshot'
import type { Plugin } from 'vite'

const CONTENT_DIR = resolve(process.cwd(), 'content')
const LOCKFILES = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']

async function hashBase(baseDir: string, watchNodeModules: string[] = []): Promise<string> {
	const hash = createHash('sha256')

	for (const name of LOCKFILES) {
		try {
			hash.update(await readFile(resolve(baseDir, name)))
			break
		} catch {}
	}

	// Include snapshot-prepare.mjs so tool-specific patch changes trigger a rebuild.
	// Those patches land in node_modules (excluded from hashDir) so without this
	// the cache would never notice them.
	try {
		hash.update(await readFile(resolve(baseDir, 'snapshot-prepare.mjs')))
	} catch {}

	async function hashDir(dir: string) {
		const entries = await readdir(dir, { withFileTypes: true })
		for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
			if (entry.name === 'node_modules') continue
			const path = resolve(dir, entry.name)
			if (entry.isDirectory()) {
				await hashDir(path)
			} else {
				hash.update(entry.name)
				hash.update(await readFile(path))
			}
		}
	}
	await hashDir(baseDir)

	// Include any extra node_modules paths declared in meta.json so rebuilding
	// a monorepo package triggers a snapshot rebuild on the next request.
	for (const pkg of watchNodeModules) {
		try {
			await hashDir(resolve(baseDir, 'node_modules', pkg))
		} catch {}
	}

	return hash.digest('hex')
}

// @webcontainer/snapshot can't serialize symlinks. node_modules/.bin/ is always
// symlinks. WebContainers uses jsh (no /bin/sh), so we replace each symlink
// with a Node.js wrapper that spawns the real script via its original relative
// path. Copying the file itself breaks relative imports (e.g. vite.js resolves
// `../dist/node/cli.js` from its own location, not from .bin/).
function resolveSymlinksInBin(baseDir: string) {
	const binDir = resolve(baseDir, 'node_modules', '.bin')
	try {
		for (const entry of readdirSync(binDir)) {
			const full = resolve(binDir, entry)
			try {
				if (lstatSync(full).isSymbolicLink()) {
					const linkTarget = readlinkSync(full) // relative, e.g. ../vite/bin/vite.js
					unlinkSync(full)
					// ESM wrapper — _base/package.json has "type":"module" so extensionless
					// files in node_modules/.bin/ are treated as ESM by Node.js.
					writeFileSync(full, [
						'#!/usr/bin/env node',
						"import{fileURLToPath,pathToFileURL}from'node:url'",
						"import{dirname,resolve}from'node:path'",
						`const d=dirname(fileURLToPath(import.meta.url))`,
						`await import(pathToFileURL(resolve(d,${JSON.stringify(linkTarget)})).href)`,
					].join('\n') + '\n', 'utf8')
					chmodSync(full, 0o755)
				}
			} catch {}
		}
	} catch {}
}

// Run the tutorial's snapshot-prepare.mjs hook if present. This is where
// tool-specific patches (shim fixes, codegen patches, etc.) live so this
// plugin stays generic.
function runPrepareHook(baseDir: string, log: (msg: string) => void) {
	const hook = resolve(baseDir, 'snapshot-prepare.mjs')
	if (!existsSync(hook)) return
	try {
		execSync(`node ${JSON.stringify(hook)} ${JSON.stringify(baseDir)}`, {
			stdio: 'inherit',
			shell: false,
		})
	} catch (e) {
		log(`[snapshot] snapshot-prepare.mjs failed: ${e}`)
		throw e
	}
}

async function ensureInstalled(baseDir: string, installScript: string, log: (msg: string) => void) {
	try {
		await stat(resolve(baseDir, 'node_modules'))
	} catch {
		log(`[snapshot] node_modules missing, running: ${installScript}`)
		execSync(installScript, { cwd: baseDir, stdio: 'inherit', shell: true })
	}
}

async function discoverTutorials(): Promise<Record<string, { baseDir: string; installScript: string; watchNodeModules: string[] }>> {
	const result: Record<string, { baseDir: string; installScript: string; watchNodeModules: string[] }> = {}
	const entries = await readdir(CONTENT_DIR, { withFileTypes: true })
	for (const entry of entries) {
		if (!entry.isDirectory()) continue
		const baseDir = resolve(CONTENT_DIR, entry.name, '_base')
		try {
			await stat(baseDir)
			const meta = JSON.parse(await readFile(resolve(CONTENT_DIR, entry.name, 'meta.json'), 'utf-8'))
			result[entry.name] = {
				baseDir,
				installScript: meta.installScript ?? 'npm install --install-links',
				watchNodeModules: meta.watchNodeModules ?? [],
			}
		} catch {}
	}
	return result
}

export function snapshotPlugin(): Plugin {
	const cache = new Map<string, { hash: string; data: Buffer }>()

	return {
		name: 'tutorial-snapshot',
		async configureServer(server) {
			const tutorials = await discoverTutorials()

			server.middlewares.use('/snapshots', async (req, res) => {
				const name = req.url?.replace(/^\//, '').replace(/\.bin$/, '') ?? ''
				const tutorial = tutorials[name]

				if (!tutorial) {
					res.statusCode = 404
					res.end(`Unknown tutorial: ${name}`)
					return
				}

				const { baseDir, installScript, watchNodeModules } = tutorial

				try {
					const log = (msg: string) => server.config.logger.info(msg)
					await ensureInstalled(baseDir, installScript, log)
					runPrepareHook(baseDir, log)

					const hash = await hashBase(baseDir, watchNodeModules)
					if (cache.get(name)?.hash !== hash) {
						server.config.logger.info(`[snapshot:${name}] building...`)
						resolveSymlinksInBin(baseDir)
						const data = await snapshot(baseDir)
						server.config.logger.info(`[snapshot:${name}] done (${(data.length / 1024 / 1024).toFixed(1)} MB)`)
						cache.set(name, { hash, data })
					}

					res.setHeader('Content-Type', 'application/octet-stream')
					res.setHeader('Cache-Control', 'no-store')
					res.end(cache.get(name)!.data)
				} catch (e) {
					const msg = String(e)
					server.config.logger.error(`[snapshot:${name}] ${msg}`)
					res.statusCode = 500
					res.end(msg)
				}
			})
		},
	}
}
