import { test, expect } from 'vitest'
import { transformTypescript } from './docs-lang'

test('change file title', async function () {
	await expect(
		transformTypescript(`\`\`\`typescript:title=route/to/typescript.ts
			console.log('hello')
        \`\`\``)
	).resolves.toMatchInlineSnapshot(`
		"\`\`\`javascript:title=route/to/typescript.js
		console.log('hello')

		\`\`\`"
	`)
})

test('strip type declarations from variable declarations', async function () {
	await expect(
		transformTypescript(`\`\`\`typescript
		import type { Type } from './source'
		const Foo: Type = () => {
			console.log('hello')
		}
        \`\`\``)
	).resolves.toMatchInlineSnapshot(`
		"\`\`\`javascript
		/** @type { import('./source').Type } */
		const Foo = () => {
		    console.log('hello')
		}

		\`\`\`"
	`)
})

test('strip type declarations from exported variable declarations', async function () {
	await expect(
		transformTypescript(`\`\`\`typescript
		import type { Type } from './source'
		export const Foo: Type = () => {
			console.log('hello')
		}
        \`\`\``)
	).resolves.toMatchInlineSnapshot(`
		"\`\`\`javascript
		/** @type { import('./source').Type } */
		export const Foo = () => {
		    console.log('hello')
		}

		\`\`\`"
	`)
})

test('function arguments', async function () {
	await expect(
		transformTypescript(`\`\`\`typescript
		import type { Type } from './source'
		export function test(event: Type) {

		}
        \`\`\``)
	).resolves.toMatchInlineSnapshot(`
		"\`\`\`javascript
		/**
		 * @param { import('./source').Type } event
		 */
		export function test(event) {}

		\`\`\`"
	`)
})
