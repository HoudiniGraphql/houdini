import { describe, expect, test, vi, beforeEach } from 'vitest'

import { plugin_path } from './plugins.js'

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
	test('resolves ./ path relative to config file', async () => {
		const result = await plugin_path('./plugins/my-plugin.js', '/project/houdini.config.js')
		expect(result.executable).toBe('/project/plugins/my-plugin.js')
		expect(result.directory).toBe('/project/plugins')
	})

	test('resolves ../ path relative to config file', async () => {
		const result = await plugin_path('../shared/plugin.js', '/project/app/houdini.config.js')
		expect(result.executable).toBe('/project/shared/plugin.js')
		expect(result.directory).toBe('/project/shared')
	})

	test('resolves absolute path as-is', async () => {
		const result = await plugin_path('/absolute/path/plugin.js', '/project/houdini.config.js')
		expect(result.executable).toBe('/absolute/path/plugin.js')
		expect(result.directory).toBe('/absolute/path')
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
			'Could not find plugin: my-plugin'
		)
	})
})
