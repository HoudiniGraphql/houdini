import { describe, expect, test } from 'vitest'

import type { PluginMeta } from './config'
import { orderedPlugins, readConfigFile } from './config'

describe('loadConfig', function () {
	test('handles malformed config file', async () => {
		const INVALID_CONFIG = '__mocks__/config.invalid.mock'

		await expect(async () => {
			await readConfigFile(INVALID_CONFIG)
		}).rejects.toThrowError(`Could not load config`)
	})
})

const getPluginTest = (name: string, order: 'core' | 'before' | 'after' | undefined) => {
	return {
		name,
		order,
		filepath: '',
	} as PluginMeta
}
const p_undefined = getPluginTest('p_undefined', undefined)
const p_before1 = getPluginTest('p_before1', 'before')
const p_before2 = getPluginTest('p_before2', 'before')
const p_core = getPluginTest('p_core', 'core')
const p_after1 = getPluginTest('p_after1', 'after')
const p_after2 = getPluginTest('p_after2', 'after')

test('orderedPlugins - simple', async () => {
	const o = orderedPlugins([p_undefined, p_before1, p_before2, p_core, p_after1, p_after2]).map(
		(p) => p.name
	)
	expect(o).toMatchInlineSnapshot(`
		[
		    "p_undefined",
		    "p_before1",
		    "p_before2",
		    "p_core",
		    "p_after1",
		    "p_after2"
		]
	`)
})

test(`orderedPlugins - put p_undefined in it's group at the bottom`, async () => {
	const o = orderedPlugins([p_before1, p_before2, p_core, p_after1, p_after2, p_undefined]).map(
		(p) => p.name
	)
	expect(o).toMatchInlineSnapshot(`
		[
		    "p_before1",
		    "p_before2",
		    "p_undefined",
		    "p_core",
		    "p_after1",
		    "p_after2"
		]
	`)
})

test(`orderedPlugins - per group then keeping the order of plugings`, async () => {
	const o = orderedPlugins([p_after2, p_after1, p_before2, p_before1, p_core, p_undefined]).map(
		(p) => p.name
	)
	expect(o).toMatchInlineSnapshot(`
		[
		    "p_before2",
		    "p_before1",
		    "p_undefined",
		    "p_core",
		    "p_after2",
		    "p_after1"
		]
	`)
})

test(`orderedPlugins - empty => empty`, async () => {
	const o = orderedPlugins([]).map((p) => p.name)
	expect(o).toMatchInlineSnapshot('[]')
})
