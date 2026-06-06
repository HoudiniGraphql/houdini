#!/usr/bin/env node
// Runs after npm install during snapshot build.
// Rolldown detects WebContainer and tries to load its wasm binding from
// /tmp/rolldown-{version}/ — but /tmp/ is always empty in WebContainers (tmpfs).
// Instead we:
//   1. Extract @rolldown/binding-wasm32-wasi into node_modules via npm pack
//      (npm skips it on macOS/Windows because of its cpu:["wasm32"] field)
//   2. Patch rolldown's WebContainer fallback to look at the project root
//      (where node_modules lives) rather than /tmp/rolldown-{version}/

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'

const baseDir = process.argv[2]
if (!baseDir) throw new Error('usage: setup-snapshot.mjs <baseDir>')

// Clean up any stale _base/tmp/ from previous attempts
rmSync(resolve(baseDir, 'tmp'), { recursive: true, force: true })

const rolldownVersion = JSON.parse(
	readFileSync(resolve(baseDir, 'node_modules', 'rolldown', 'package.json'), 'utf-8')
).version

// 1. Extract the binding into node_modules via npm pack
const wasiPkg = resolve(baseDir, 'node_modules', '@rolldown', 'binding-wasm32-wasi')
if (!existsSync(wasiPkg)) {
	console.log(`  extracting @rolldown/binding-wasm32-wasi@${rolldownVersion} via npm pack`)
	const packDir = mkdtempSync(resolve(tmpdir(), 'rolldown-pack-'))
	try {
		execSync(
			`npm pack @rolldown/binding-wasm32-wasi@${rolldownVersion} --pack-destination ${JSON.stringify(packDir)}`,
			{ stdio: 'inherit' }
		)
		const tarball = readdirSync(packDir)[0]
		mkdirSync(wasiPkg, { recursive: true })
		execSync(`tar xzf ${JSON.stringify(resolve(packDir, tarball))} -C ${JSON.stringify(wasiPkg)} --strip-components=1`)
	} finally {
		rmSync(packDir, { recursive: true, force: true })
	}
}

// 2. Patch rolldown's WebContainer fallback: change baseDir from /tmp/rolldown-{version}/
//    to the project root, so it finds the binding we just extracted in node_modules.
const sharedDir = resolve(baseDir, 'node_modules', 'rolldown', 'dist', 'shared')
const [bindingFile] = readdirSync(sharedDir).filter((f) => f.startsWith('binding-') && f.endsWith('.mjs'))
if (bindingFile) {
	const filePath = resolve(sharedDir, bindingFile)
	const original = readFileSync(filePath, 'utf-8')
	const patched = original.replace(
		'const baseDir = `/tmp/rolldown-${version}`;',
		"const baseDir = __require('path').resolve(__require.resolve('rolldown/package.json'), '../../..');"
	)
	if (patched !== original) {
		writeFileSync(filePath, patched, 'utf-8')
		console.log(`  patched ${bindingFile}: baseDir → project root`)
	}
}
