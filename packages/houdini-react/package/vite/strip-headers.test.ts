import { parseJS, printJS } from 'houdini'
import { test, expect, describe } from 'vitest'

import { strip_named_export } from './strip-headers.js'

async function strip(code: string): Promise<string> {
	const script = parseJS(code, { plugins: ['jsx'] })
	strip_named_export(script, 'headers')
	const { code: out } = await printJS(script)
	return out.trim()
}

describe('strip_named_export', () => {
	test('removes an exported function declaration', async () => {
		const out = await strip(
			`export function headers() { return { 'X-A': 'b' } }\nexport default () => null`
		)
		expect(out).not.toContain('headers')
		expect(out).toContain('export default')
	})

	test('removes an exported const declaration', async () => {
		const out = await strip(`export const headers = () => ({})\nexport default () => null`)
		expect(out).not.toContain('headers')
		expect(out).toContain('export default')
	})

	test('removes a headers specifier from an export list but keeps the others', async () => {
		const out = await strip(
			`const headers = () => ({})\nconst other = 1\nexport { headers, other }\nexport default () => null`
		)
		expect(out).not.toMatch(/export\s*\{[^}]*headers/)
		expect(out).toContain('other')
	})

	test('removes an aliased headers export', async () => {
		const out = await strip(
			`const fn = () => ({})\nexport { fn as headers }\nexport default () => null`
		)
		expect(out).not.toMatch(/as headers/)
	})

	test('leaves unrelated exports untouched', async () => {
		const out = await strip(`export const other = 1\nexport default () => null`)
		expect(out).toContain('other')
		expect(out).toContain('export default')
	})
})
