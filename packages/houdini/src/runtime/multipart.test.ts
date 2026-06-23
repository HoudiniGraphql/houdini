import { test, expect, describe } from 'vitest'

import { buildGraphQLBody } from './multipart.js'

describe('buildGraphQLBody', () => {
	test('plain JSON body when there are no files', () => {
		const result = buildGraphQLBody('mutation M($name: String!) { ok }', { name: 'Alice' })
		expect(result.contentType).toBe('application/json')
		expect(JSON.parse(result.body as string)).toEqual({
			query: 'mutation M($name: String!) { ok }',
			variables: { name: 'Alice' },
		})
	})

	test('multipart body following the GraphQL multipart spec when a file is present', () => {
		const file = new Blob(['hi'], { type: 'text/plain' })
		const result = buildGraphQLBody('mutation M($file: Upload!) { ok }', { file })

		expect(result.contentType).toBeUndefined() // FormData sets multipart + boundary
		const form = result.body as FormData

		// operations: the file is nulled out
		const operations = JSON.parse(form.get('operations') as string)
		expect(operations.variables).toEqual({ file: null })

		// map: part "1" points at the file's location in operations
		expect(JSON.parse(form.get('map') as string)).toEqual({ '1': ['variables.file'] })

		// and the file itself rides as part "1"
		expect(form.get('1')).toBeInstanceOf(Blob)
	})

	test('records the dotted path for a nested file', () => {
		const file = new Blob(['x'])
		const result = buildGraphQLBody('mutation M($input: I!) { ok }', { input: { avatar: file } })
		const form = result.body as FormData
		expect(JSON.parse(form.get('map') as string)).toEqual({ '1': ['variables.input.avatar'] })
	})

	test('the same file referenced twice collapses to one part with both paths', () => {
		// the spec wants a single file part whose map entry lists every location it appears at
		const file = new Blob(['x'])
		const result = buildGraphQLBody('mutation M { ok }', { avatar: file, cover: file })
		const form = result.body as FormData
		expect(JSON.parse(form.get('map') as string)).toEqual({
			'1': ['variables.avatar', 'variables.cover'],
		})
		// one part, not two
		expect(form.getAll('1')).toHaveLength(1)
		expect(form.get('2')).toBeNull()
	})

	test('records index paths for files inside a list', () => {
		const a = new Blob(['a'])
		const b = new Blob(['b'])
		const result = buildGraphQLBody('mutation M($files: [Upload!]!) { ok }', { files: [a, b] })
		const form = result.body as FormData
		// the array branch builds an index segment per element
		expect(JSON.parse(form.get('map') as string)).toEqual({
			'1': ['variables.files.0'],
			'2': ['variables.files.1'],
		})
		const operations = JSON.parse(form.get('operations') as string)
		expect(operations.variables).toEqual({ files: [null, null] })
	})
})
