import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'

import { posixify, resolve } from './path.js'
import { is_node_script, plugin_path } from './plugins.js'

// plugin_path's local-path branch never touches the filesystem, but the module
// imports fs.ts which depends on glob — mock it to keep the test lightweight.
vi.mock('glob', () => ({ glob: vi.fn() }))

// vi.mock factories are hoisted before variable declarations, so use vi.hoisted.
const { mockReadFile, mockExistsSync } = vi.hoisted(() => ({
	mockReadFile: vi.fn<() => Promise<string | null>>(),
	mockExistsSync: vi.fn<() => boolean>(),
}))

vi.mock('./fs.js', () => ({
	readFile: mockReadFile,
	existsSync: mockExistsSync,
}))

// Stub module resolution so npm-branch tests don't hit the real filesystem.
vi.mock('node:module', () => ({
	createRequire: vi.fn(() => ({
		resolve: (pkg: string) => {
			if (pkg === 'my-plugin/package.json') {
				return '/fake/node_modules/my-plugin/package.json'
			}
			throw new Error(`Cannot find module '${pkg}'`)
		},
	})),
}))

describe('plugin_path local resolution', () => {
	// absolute paths pick up a drive letter on windows, so build the expectations the same way
	const abs = (p: string) => resolve(p)

	test('resolves ./ path relative to config file', async () => {
		const result = await plugin_path('./plugins/my-plugin.js', '/project/houdini.config.js')
		expect(result.executable).toBe(abs('/project/plugins/my-plugin.js'))
		expect(result.directory).toBe(abs('/project/plugins'))
	})

	test('resolves ../ path relative to config file', async () => {
		const result = await plugin_path('../shared/plugin.js', '/project/app/houdini.config.js')
		expect(result.executable).toBe(abs('/project/shared/plugin.js'))
		expect(result.directory).toBe(abs('/project/shared'))
	})

	test('resolves absolute path as-is', async () => {
		const result = await plugin_path(
			abs('/absolute/path/plugin.js'),
			'/project/houdini.config.js'
		)
		expect(result.executable).toBe(abs('/absolute/path/plugin.js'))
		expect(result.directory).toBe(abs('/absolute/path'))
	})

	test('throws for unknown npm package', async () => {
		await expect(
			plugin_path('nonexistent-package-xyz-123', '/project/houdini.config.js')
		).rejects.toThrow()
	})
})

describe('plugin_path npm package resolution', () => {
	beforeEach(() => {
		mockReadFile.mockReset()
		mockExistsSync.mockReset()
	})

	test('resolves bin as string', async () => {
		mockReadFile.mockResolvedValue(JSON.stringify({ name: 'my-plugin', bin: 'bin/my-plugin' }))
		const result = await plugin_path('my-plugin', '/project/houdini.config.js')
		expect(result.executable).toBe('/fake/node_modules/my-plugin/bin/my-plugin')
		expect(result.directory).toBe('/fake/node_modules/my-plugin')
	})

	test('resolves bin as object (npm publish normalization)', async () => {
		mockReadFile.mockResolvedValue(
			JSON.stringify({ name: 'my-plugin', bin: { 'my-plugin': 'bin/my-plugin' } })
		)
		const result = await plugin_path('my-plugin', '/project/houdini.config.js')
		expect(result.executable).toBe('/fake/node_modules/my-plugin/bin/my-plugin')
		expect(result.directory).toBe('/fake/node_modules/my-plugin')
	})

	test('throws when bin is missing', async () => {
		mockReadFile.mockResolvedValue(JSON.stringify({ name: 'my-plugin' }))
		await expect(plugin_path('my-plugin', '/project/houdini.config.js')).rejects.toThrow(
			"Found package 'my-plugin' but it has no bin field"
		)
	})
})

describe('is_node_script', () => {
	const root = posixify(mkdtempSync(`${tmpdir()}/houdini-script-`))
	afterAll(() => rmSync(root, { recursive: true, force: true }))

	const write = (name: string, content: string | Buffer) => {
		const file = `${root}/${name}`
		writeFileSync(file, content)
		return file
	}

	test.each(['.js', '.mjs', '.cjs'])('%s files run through node', (ext) => {
		expect(is_node_script(`/missing/plugin${ext}`)).toBe(true)
	})

	test('scripts with a node shebang run through node', () => {
		expect(is_node_script(write('shim', '#!/usr/bin/env node\nconsole.log(1)\n'))).toBe(true)
		expect(is_node_script(write('plugin.v2', '#!/usr/bin/node\n'))).toBe(true)
	})

	test('other interpreters are spawned directly', () => {
		expect(is_node_script(write('wrapper', '#!/bin/sh\nexec go run . "$@"\n'))).toBe(false)
		expect(is_node_script(write('script', '#!/usr/bin/env python3\n'))).toBe(false)
	})

	test('native binaries are spawned directly', () => {
		expect(is_node_script(write('binary', Buffer.from([0x7f, 0x45, 0x4c, 0x46])))).toBe(false)
		expect(is_node_script(write('binary.exe', '#!/usr/bin/env node\n'))).toBe(false)
		expect(is_node_script(`${root}/plugin.wasm`)).toBe(false)
		expect(is_node_script(`${root}/missing`)).toBe(false)
	})
})
