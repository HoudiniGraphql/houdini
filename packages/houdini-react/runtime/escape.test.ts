import { test, expect, describe } from 'vitest'

import { escapeScriptTag } from './escape.js'

describe('escapeScriptTag', () => {
	test('neutralizes a </script> breakout but stays valid JSON', () => {
		const payload = { name: '</script><script>alert(1)</script>' }
		const out = escapeScriptTag(JSON.stringify(payload))
		// no raw "<" survives, so it cannot break out of the inline <script>
		expect(out).not.toContain('<')
		// still parses back to the original value (escaping is lossless)
		expect(JSON.parse(out)).toEqual(payload)
	})

	test('escapes the U+2028 / U+2029 line terminators', () => {
		const payload = { x: String.fromCharCode(0x2028) + String.fromCharCode(0x2029) }
		const out = escapeScriptTag(JSON.stringify(payload))
		expect(out).not.toContain(String.fromCharCode(0x2028))
		expect(out).not.toContain(String.fromCharCode(0x2029))
		expect(JSON.parse(out)).toEqual(payload)
	})
})
