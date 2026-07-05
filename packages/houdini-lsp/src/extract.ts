// Live extraction of GraphQL documents from source files while the user types.
//
// This mirrors the Go extractor (packages/houdini-core/plugin/documents/processFile.go):
// the same comment stripping and the same two regexes, so the blocks we find in the
// editor buffer line up with the raw_documents rows the pipeline writes on save. We
// can't use the database offsets directly here because the buffer shifts as the user
// types between saves.

export type Position = { line: number; character: number }

export type Block = {
	content: string
	// 0-based position of the first character of `content` in the host file
	offsetLine: number
	offsetColumn: number
	// the prop name when the block is an inline component field (GraphQL<`...`>)
	prop?: string
}

// matches documents within backticks (same subpattern as the Go extractor)
const QUERY_PATTERN = '\\s*`((?:\\\\`|[^`])*?)`\\s*'
const GRAPHQL_CALL = new RegExp(`graphql\\(${QUERY_PATTERN}\\)`, 'gd')
// the prop name is captured (group 1) ahead of the content (group 2)
const COMPONENT_FIELD = new RegExp(`(\\w+)\\s*:\\s*GraphQL<\\s*${QUERY_PATTERN}\\s*>`, 'gd')

export function extract_blocks(text: string, uri: string): Block[] {
	// .graphql/.gql files are a single document covering the whole file
	if (uri.endsWith('.graphql') || uri.endsWith('.gql')) {
		return [{ content: text, offsetLine: 0, offsetColumn: 0 }]
	}

	// strip comments (preserving positions) so commented-out graphql() calls are skipped
	const stripped = strip_comments(text)

	// precompute newline positions so index → line/column is a binary search
	const newlines: number[] = []
	for (let i = 0; i < text.length; i++) {
		if (text[i] === '\n') newlines.push(i)
	}

	const blocks: Block[] = []
	for (const [regex, contentGroup] of [
		[GRAPHQL_CALL, 1],
		[COMPONENT_FIELD, 2],
	] as const) {
		regex.lastIndex = 0
		for (const match of stripped.matchAll(regex)) {
			const indices = match.indices?.[contentGroup]
			if (!indices) continue
			const [start, end] = indices
			const { line, character } = index_position(newlines, start)
			blocks.push({
				// the Go extractor unescapes \` the same way; positions after an escaped
				// backtick drift by one column, which never matters for GraphQL content
				content: text.slice(start, end).replaceAll('\\`', '`'),
				offsetLine: line,
				offsetColumn: character,
				...(contentGroup === 2 ? { prop: match[1] } : {}),
			})
		}
	}
	return blocks
}

// strip_comments replaces JS/TS comment content with spaces, preserving all positions.
// Newlines inside block comments are kept so line numbers stay correct. String and
// template literals are skipped so comment-like sequences inside them are left intact.
function strip_comments(src: string): string {
	const b = src.split('')
	let i = 0
	while (i < b.length) {
		if (b[i] === '/' && b[i + 1] === '/') {
			while (i < b.length && b[i] !== '\n') {
				b[i] = ' '
				i++
			}
		} else if (b[i] === '/' && b[i + 1] === '*') {
			b[i] = ' '
			b[i + 1] = ' '
			i += 2
			while (i < b.length) {
				if (b[i] === '*' && b[i + 1] === '/') {
					b[i] = ' '
					b[i + 1] = ' '
					i += 2
					break
				}
				if (b[i] !== '\n') b[i] = ' '
				i++
			}
		} else if (b[i] === "'" || b[i] === '"') {
			const q = b[i]
			i++
			while (i < b.length) {
				if (b[i] === '\\') {
					i += 2
					continue
				}
				if (b[i] === q) {
					i++
					break
				}
				i++
			}
		} else if (b[i] === '`') {
			i++
			while (i < b.length) {
				if (b[i] === '\\') {
					i += 2
					continue
				}
				if (b[i] === '`') {
					i++
					break
				}
				i++
			}
		} else {
			i++
		}
	}
	return b.join('')
}

function index_position(newlines: number[], index: number): Position {
	let lo = 0
	let hi = newlines.length
	while (lo < hi) {
		const mid = (lo + hi) >> 1
		if (newlines[mid] < index) lo = mid + 1
		else hi = mid
	}
	return {
		line: lo,
		character: lo === 0 ? index : index - newlines[lo - 1] - 1,
	}
}

// ── position mapping ──────────────────────────────────────────────────────────

export function block_at(blocks: Block[], position: Position): Block | null {
	for (const block of blocks) {
		const lines = block.content.split('\n')
		const endLine = block.offsetLine + lines.length - 1
		const endChar =
			lines.length === 1
				? block.offsetColumn + lines[0].length
				: lines[lines.length - 1].length

		if (position.line < block.offsetLine || position.line > endLine) continue
		if (position.line === block.offsetLine && position.character < block.offsetColumn)
			continue
		if (position.line === endLine && position.character > endChar) continue
		return block
	}
	return null
}

// The pipeline reports single-point error locations (usually at a name). Extend the
// range over the identifier containing that position so the squiggle covers the
// token — this also self-corrects small column-base disagreements, since a position
// anywhere inside the token snaps to its boundaries. Falls back to a one-character
// range when the position isn't on an identifier (or the text isn't available).
export function identifier_range(
	text: string | undefined,
	line: number,
	character: number
): { start: Position; end: Position } {
	const point = {
		start: { line, character },
		end: { line, character: character + 1 },
	}
	if (!text) return point
	const lineText = text.split('\n')[line]
	if (!lineText) return point

	for (const match of lineText.matchAll(/[_A-Za-z][_0-9A-Za-z]*/g)) {
		const start = match.index
		const end = start + match[0].length
		if (character >= start && character < end) {
			return { start: { line, character: start }, end: { line, character: end } }
		}
		if (start > character) break
	}
	return point
}

// host-file position → position within block.content
export function to_local(block: Block, position: Position): Position {
	return {
		line: position.line - block.offsetLine,
		character:
			position.line === block.offsetLine
				? position.character - block.offsetColumn
				: position.character,
	}
}

// position within block.content → host-file position
export function to_host(block: Block, position: Position): Position {
	return {
		line: block.offsetLine + position.line,
		character: position.line === 0 ? block.offsetColumn + position.character : position.character,
	}
}
