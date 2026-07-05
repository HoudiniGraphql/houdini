import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

import { extract_blocks } from './extract'

// The Go extractor (houdini-core/plugin/documents/processFile.go) is the authority;
// this module re-implements it for unsaved editor buffers. Both run the shared
// corpus against one golden — TestExtractParityGolden covers the Go side. If either
// half fails, the extractors have drifted and inline-document positions are wrong.
const FIXTURES = fileURLToPath(
	new URL('../../houdini-core/plugin/documents/testdata/extract-parity/', import.meta.url)
)

test('extract_blocks matches the Go extractor on the shared corpus', () => {
	const text = readFileSync(`${FIXTURES}corpus.tsx`, 'utf-8')
	const expected = JSON.parse(readFileSync(`${FIXTURES}expected.json`, 'utf-8'))

	const got = extract_blocks(text, 'file:///corpus.tsx').map((block) => ({
		content: block.content,
		row: block.offsetLine,
		column: block.offsetColumn,
		prop: block.prop ?? '',
	}))

	expect(got).toEqual(expected)
})
