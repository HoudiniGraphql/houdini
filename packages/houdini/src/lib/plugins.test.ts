import { describe, expect, test, vi } from 'vitest'

import { plugin_path } from './plugins.js'

// plugin_path's local-path branch never touches the filesystem, but the module
// imports fs.ts which depends on glob — mock it to keep the test lightweight.
vi.mock('glob', () => ({ glob: vi.fn() }))
vi.mock('./fs.js', () => ({
	readFile: vi.fn(),
	existsSync: vi.fn(),
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
