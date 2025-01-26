import { test, expect } from 'vitest'

import { serializeValue } from './utils'

test('can serialize keys with next', async () => {
	expect(serializeValue({ next: '1' })).toMatchInlineSnapshot(`
		{
		    "next": "1"
		}
	`)
})

test('can serialize keys with prev', async () => {
	expect(serializeValue({ next: '1' })).toMatchInlineSnapshot(`
		{
		    "next": "1"
		}
	`)
})
