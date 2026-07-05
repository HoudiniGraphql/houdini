import { describe, expect, test } from 'vitest'

import { block_at, extract_blocks, identifier_range, to_host, to_local } from './extract'

const tsFile = `import { graphql } from '$houdini'

// graphql(\`query Commented { user }\`)
const store = graphql(\`
	query MyQuery {
		user {
			name
		}
	}
\`)

type Props = {
	user: GraphQL<\`
		fragment UserInfo on User {
			name
		}
	\`>
}
`

describe('extract_blocks', () => {
	test('finds graphql() calls and GraphQL<> props, skips comments', () => {
		const blocks = extract_blocks(tsFile, 'file:///src/foo.ts')
		expect(blocks).toHaveLength(2)
		expect(blocks[0].content).toContain('query MyQuery')
		expect(blocks[1].content).toContain('fragment UserInfo')
	})

	test('records the 0-based offset of the content start', () => {
		const [block] = extract_blocks(tsFile, 'file:///src/foo.ts')
		// graphql(` is on line 3; content starts right after the backtick
		expect(block.offsetLine).toBe(3)
		expect(block.offsetColumn).toBe(23)
	})

	test('component field blocks capture the prop name', () => {
		const blocks = extract_blocks(tsFile, 'file:///src/foo.ts')
		expect(blocks[0].prop).toBeUndefined()
		expect(blocks[1].prop).toBe('user')
	})

	test('.gql files are a single block at the origin', () => {
		const blocks = extract_blocks('query Q { user }', 'file:///a.gql')
		expect(blocks).toHaveLength(1)
		expect(blocks[0].offsetLine).toBe(0)
		expect(blocks[0].offsetColumn).toBe(0)
	})

	test('skips comments that look like graphql calls (matching the Go extractor)', () => {
		const source = [
			`/* graphql(\`query AlsoNot { x }\`) */`,
			`const b = graphql(\`query Real { x }\`)`,
		].join('\n')
		const blocks = extract_blocks(source, 'file:///b.ts')
		expect(blocks.map((b) => b.content)).toEqual(['query Real { x }'])
	})
})

describe('position mapping', () => {
	const blocks = extract_blocks(tsFile, 'file:///src/foo.ts')

	test('block_at finds the containing block', () => {
		// cursor on "name" inside MyQuery: host line 6
		expect(block_at(blocks, { line: 6, character: 3 })).toBe(blocks[0])
		expect(block_at(blocks, { line: 0, character: 5 })).toBeNull()
	})

	test('to_local / to_host round-trip', () => {
		const pos = { line: 6, character: 3 }
		const local = to_local(blocks[0], pos)
		expect(local.line).toBe(3)
		expect(to_host(blocks[0], local)).toEqual(pos)
	})

	test('first line of a block shifts by the column offset', () => {
		const block = { content: 'query Q { x }', offsetLine: 5, offsetColumn: 20 }
		expect(to_local(block, { line: 5, character: 26 })).toEqual({ line: 0, character: 6 })
		expect(to_host(block, { line: 0, character: 6 })).toEqual({ line: 5, character: 26 })
	})
})

describe('identifier_range', () => {
	const text = 'query Q {\n\thellox\n}\n'

	test('expands a point on a token to the whole identifier', () => {
		expect(identifier_range(text, 1, 1)).toEqual({
			start: { line: 1, character: 1 },
			end: { line: 1, character: 7 },
		})
	})

	test('a position anywhere inside the token snaps to its boundaries', () => {
		// self-corrects a 1-based column pointing one past the token start
		expect(identifier_range(text, 1, 2)).toEqual({
			start: { line: 1, character: 1 },
			end: { line: 1, character: 7 },
		})
	})

	test('falls back to a single character off-identifier or without text', () => {
		expect(identifier_range(text, 0, 8)).toEqual({
			start: { line: 0, character: 8 },
			end: { line: 0, character: 9 },
		})
		expect(identifier_range(undefined, 3, 4)).toEqual({
			start: { line: 3, character: 4 },
			end: { line: 3, character: 5 },
		})
		expect(identifier_range(text, 99, 0)).toEqual({
			start: { line: 99, character: 0 },
			end: { line: 99, character: 1 },
		})
	})
})
