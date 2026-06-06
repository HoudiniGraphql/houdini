#!/usr/bin/env node
// Houdini-specific snapshot preparation. Called by snapshotPlugin before each
// snapshot build. Receives baseDir as the first CLI argument.
//
// Responsibilities:
//   - patch codegen.js detached flag (WebContainers breaks detached child pipes)
//   - patch shims for houdini-core / houdini-react with the monorepo template
//   - copy locally-built *-wasm packages when npm skipped optional deps

import { chmodSync, cpSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const baseDir = process.argv[2]
if (!baseDir) {
	console.error('snapshot-prepare: baseDir argument required')
	process.exit(1)
}

// Walk up from _base to find the monorepo packages/ dir
const monorepoPackagesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../packages')

// ── shim aliases ───────────────────────────────────────────────────────────
// Replace houdini-core / houdini-react bin shims with the monorepo template so
// the MessageChannel+Atomics stdin relay is always present.
const templatePath = resolve(monorepoPackagesDir, '_scripts', 'templates', 'shim.cjs')
if (existsSync(templatePath)) {
	const template = readFileSync(templatePath, 'utf-8')

	for (const pkg of ['houdini-core', 'houdini-react']) {
		const pkgDir = resolve(baseDir, 'node_modules', pkg)
		const pkgJsonPath = resolve(pkgDir, 'package.json')
		if (!existsSync(pkgJsonPath)) continue

		const envVar = pkg === 'houdini-core' ? 'HOUDINI_CORE_BINARY_PATH' : 'HOUDINI_REACT_BINARY_PATH'
		const content = template
			.replace(/my-binary/g, pkg)
			.replace(/my-package/g, pkg)
			.replace('MY_PACKAGE_BINARY_PATH', envVar)
			.replace('args: process.argv,', 'args: [wasmBin, ...process.argv.slice(2)],')

		const shim = resolve(pkgDir, 'bin', pkg)
		const shimJs = resolve(pkgDir, 'bin', `${pkg}.js`)

		if (existsSync(shim) && statSync(shim).size < 100_000) {
			writeFileSync(shim, content, 'utf-8')
			chmodSync(shim, 0o755)
		}
		writeFileSync(shimJs, content, 'utf-8')
		chmodSync(shimJs, 0o755)

		const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
		pkgJson.bin = `bin/${pkg}.js`
		writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, '\t'), 'utf-8')
	}
}

// ── local wasm fallbacks ───────────────────────────────────────────────────
// If npm skipped optional *-wasm deps (not yet published), copy from monorepo.
let pkg
try { pkg = JSON.parse(readFileSync(resolve(baseDir, 'package.json'), 'utf-8')) } catch { }
if (pkg) {
	for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies })) {
		if (!dep.endsWith('-wasm')) continue
		const installedDir = resolve(baseDir, 'node_modules', dep)
		if (existsSync(installedDir)) continue
		const sourcePackage = dep.replace(/-wasm$/, '')
		const localBuild = resolve(monorepoPackagesDir, sourcePackage, 'build', dep)
		if (existsSync(localBuild)) {
			console.log(`  [snapshot-prepare] ${dep} not in node_modules, copying from local build`)
			cpSync(localBuild, installedDir, { recursive: true })
		}
	}
}
