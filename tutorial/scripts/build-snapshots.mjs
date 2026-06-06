#!/usr/bin/env node
// Discovers every content/*/_base directory, runs the tutorial's installScript,
// builds a WebContainers snapshot, and writes it to public/snapshots/<name>.bin.

import { execSync } from 'node:child_process'
import { chmodSync, cpSync, existsSync, lstatSync, readdirSync, readFileSync, readlinkSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { readdir, mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { snapshot } from '@webcontainer/snapshot'

const tutorialDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const monorepoPackagesDir = resolve(tutorialDir, '../packages')
const contentDir = resolve(tutorialDir, 'content')
const outDir = resolve(tutorialDir, 'public/snapshots')

function resolveSymlinksInBin(baseDir) {
	const binDir = resolve(baseDir, 'node_modules', '.bin')
	try {
		for (const entry of readdirSync(binDir)) {
			const full = resolve(binDir, entry)
			try {
				if (lstatSync(full).isSymbolicLink()) {
					const linkTarget = readlinkSync(full)
					unlinkSync(full)
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

function patchCodegen(baseDir) {
	// Must run AFTER the monorepo cpSync override (which copies lib/codegen.js
	// from the local build and overwrites any earlier patch).
	// With detached:true on Linux, WebContainers doesn't plumb the pipe to the
	// child's fd=0 correctly, so the child gets EBADF on stdin.
	const codegenPath = resolve(baseDir, 'node_modules', 'houdini', 'lib', 'codegen.js')
	if (!existsSync(codegenPath)) return
	const content = readFileSync(codegenPath, 'utf-8')
	const patched = content.replace('detached: process.platform !== "win32"', 'detached: false')
	if (patched !== content) {
		writeFileSync(codegenPath, patched, 'utf-8')
		console.log('  patched codegen.js: detached: false')
	}
}

function addJsShimAliases(baseDir) {
	// Generate shims from the monorepo template so all fixes (uncaughtException
	// handler, signalEOF, etc.) are always present regardless of what npm installed.
	const templatePath = resolve(monorepoPackagesDir, '_scripts', 'templates', 'shim.cjs')
	if (!existsSync(templatePath)) {
		console.warn('  shim template not found, skipping .js alias generation')
		return
	}
	const template = readFileSync(templatePath, 'utf-8')

	for (const pkg of ['houdini-core', 'houdini-react']) {
		const pkgDir = resolve(baseDir, 'node_modules', pkg)
		const shimJs = resolve(pkgDir, 'bin', `${pkg}.js`)
		const pkgJsonPath = resolve(pkgDir, 'package.json')
		if (!existsSync(pkgJsonPath)) continue

		const envVar = pkg === 'houdini-core' ? 'HOUDINI_CORE_BINARY_PATH' : 'HOUDINI_REACT_BINARY_PATH'
		const content = template
			.replace(/my-binary/g, pkg)
			.replace(/my-package/g, pkg)
			.replace('MY_PACKAGE_BINARY_PATH', envVar)
			.replace('args: process.argv,', 'args: [wasmBin, ...process.argv.slice(2)],')
		// Overwrite the binary shim too: resolveSymlinksInBin converts the .bin/
		// symlink (which points to bin/<pkg>, no extension) into a file that imports
		// that exact path, so the binary shim must have our fixes even if the .js
		// alias is also present.
		const shim = resolve(pkgDir, 'bin', pkg)
		if (existsSync(shim) && statSync(shim).size < 100_000) {
			writeFileSync(shim, content, 'utf-8')
			chmodSync(shim, 0o755)
		}
		writeFileSync(shimJs, content, 'utf-8')
		chmodSync(shimJs, 0o755)
		const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
		pkgJson.bin = `bin/${pkg}.js`
		writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, '\t'), 'utf-8')
		console.log(`  patched shim for ${pkg}`)
	}
}


function copyLocalWasmFallbacks(baseDir) {
	let pkg
	try {
		pkg = JSON.parse(readFileSync(resolve(baseDir, 'package.json'), 'utf-8'))
	} catch {
		return
	}
	const allDeps = Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies })
	for (const dep of allDeps) {
		if (!dep.endsWith('-wasm')) continue
		const installedDir = resolve(baseDir, 'node_modules', dep)
		if (existsSync(installedDir)) continue
		const sourcePackage = dep.replace(/-wasm$/, '')
		const localBuild = resolve(monorepoPackagesDir, sourcePackage, 'build', dep)
		if (existsSync(localBuild)) {
			console.log(`  copying local ${dep} from monorepo build`)
			cpSync(localBuild, installedDir, { recursive: true })
		}
	}
}

const entries = await readdir(contentDir, { withFileTypes: true })
const tutorials = (
	await Promise.all(
		entries
			.filter((e) => e.isDirectory())
			.map(async (e) => {
				const baseDir = resolve(contentDir, e.name, '_base')
				try {
					await stat(baseDir)
					const meta = JSON.parse(await readFile(resolve(contentDir, e.name, 'meta.json'), 'utf-8'))
					return {
						name: e.name,
						baseDir,
						contentDir: resolve(contentDir, e.name),
						installScript: meta.installScript ?? 'npm install --install-links',
						setupSnapshot: meta.setupSnapshot ?? null,
					}
				} catch {
					return null
				}
			})
	)
).filter(Boolean)

if (tutorials.length === 0) {
	console.error('No tutorials found (expected content/*/_base directories)')
	process.exit(1)
}

await mkdir(outDir, { recursive: true })

for (const { name, baseDir, contentDir: tutorialContentDir, installScript, setupSnapshot } of tutorials) {
	console.log(`\n[${name}] installing dependencies...`)
	console.log(`  $ ${installScript}`)
	execSync(installScript, { cwd: baseDir, stdio: 'inherit', shell: true })
	if (setupSnapshot) {
		const scriptPath = resolve(tutorialContentDir, setupSnapshot)
		execSync(`node ${JSON.stringify(scriptPath)} ${JSON.stringify(baseDir)}`, { stdio: 'inherit' })
	}
	addJsShimAliases(baseDir)
	copyLocalWasmFallbacks(baseDir)

	// ── houdini monorepo dev overrides ────────────────────────────────────────
	// Copy locally-built houdini packages on top of the npm-installed versions so
	// in-progress changes are included without a publish. Delete this block when
	// the tutorial lives in its own repo.
	for (const pkg of ['houdini', 'houdini-adapter-node']) {
		const localBuild = resolve(monorepoPackagesDir, pkg, 'build')
		const installedDir = resolve(baseDir, 'node_modules', pkg)
		if (existsSync(localBuild) && existsSync(installedDir)) {
			console.log(`  [dev] overriding ${pkg} with local monorepo build`)
			cpSync(localBuild, installedDir, { recursive: true, force: true })
		}
	}
	// ── end houdini monorepo dev overrides ────────────────────────────────────
	// patchCodegen must run after the monorepo override above so it patches the
	// local build's codegen.js, not the npm-installed version.
	patchCodegen(baseDir)

	console.log(`[${name}] resolving symlinks...`)
	resolveSymlinksInBin(baseDir)
	console.log(`[${name}] building snapshot...`)
	const data = await snapshot(baseDir)

	const outPath = resolve(outDir, `${name}.bin`)
	await writeFile(outPath, data)
	console.log(`[${name}] → public/snapshots/${name}.bin (${(data.length / 1024 / 1024).toFixed(1)} MB)`)
}
