import { test, expect, describe } from 'vitest'

import { parseJS, parseJSON } from './parse'

describe('parse', function () {
	test('parseJSON without comments', async function () {
		const original_file = `{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "noImplicitAny": true
  }
}
`

		const parsed = parseJSON(original_file)
		expect(parsed).toMatchObject({
			extends: './.svelte-kit/tsconfig.json',
			compilerOptions: {
				allowJs: true,
				checkJs: true,
				esModuleInterop: true,
				forceConsistentCasingInFileNames: true,
				resolveJsonModule: true,
				skipLibCheck: true,
				sourceMap: true,
				strict: true,
				noImplicitAny: true,
			},
		})
	})

	test('parseJSON with comments', async function () {
		const original_file = `{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "allowJs": true,
		// this is a comment
    "checkJs": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "noImplicitAny": true
  }
	// this is another comment
}
`

		const parsed = parseJSON(original_file)
		expect(parsed).toMatchObject({
			extends: './.svelte-kit/tsconfig.json',
			compilerOptions: {
				allowJs: true,
				checkJs: true,
				esModuleInterop: true,
				forceConsistentCasingInFileNames: true,
				resolveJsonModule: true,
				skipLibCheck: true,
				sourceMap: true,
				strict: true,
				noImplicitAny: true,
			},
		})
	})

	test('parseJS with decorators', async function () {
		const parsed = parseJS(`
			const a = 1
			const b = 2

			@annotation
			export class Test {}
		`)
		expect(parsed).toMatchInlineSnapshot(`
			const a = 1;
			const b = 2;

			@annotation
			export class Test {}
		`)
	})

	test('parseJS with jsx (tabs)', async function () {
		const parsed = parseJS(
			`export default function () {
			return (<>Hello\tWorld</>)
		}`
		)
		expect(parsed).toMatchInlineSnapshot(`
			export default function() {
			    return (<>Hello	World</>);
			}
		`)
	})
})
