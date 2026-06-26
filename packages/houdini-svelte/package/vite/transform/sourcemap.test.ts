import { decode, encode } from '@jridgewell/sourcemap-codec'
import { test, expect } from 'vitest'

import { offset_script_sourcemap } from './index'

// A .svelte file's <script> is extracted and parsed on its own, so recast's source map is
// relative to the script content. offset_script_sourcemap must move it into "full file" space:
// both the generated and the original line of every mapping shift down by the number of lines
// that precede the <script> tag.
test('offset_script_sourcemap shifts generated AND original lines by the script offset', () => {
	// extracted-script map: generated line 0 -> source line 0, generated line 1 -> source line 5
	const rawMap = { mappings: encode([[[0, 0, 0, 0]], [[0, 0, 5, 0]]]), names: [] }
	const content = '<h1>a</h1>\n<h1>b</h1>\n<h1>c</h1>\n<script>...'

	const out = offset_script_sourcemap(rawMap, 3, 'src/routes/+page.svelte', content) as any
	const decoded = decode(out.mappings)

	// 3 empty generated lines prepended (the markup/lines before the <script> tag)
	expect(decoded.slice(0, 3)).toEqual([[], [], []])
	// generated line 3 -> original line 3 (0 + 3); generated line 4 -> original line 8 (5 + 3)
	expect(decoded[3][0][2]).toBe(3)
	expect(decoded[4][0][2]).toBe(8)

	// the map names and embeds the full .svelte source
	expect(out.version).toBe(3)
	expect(out.sources).toEqual(['src/routes/+page.svelte'])
	expect(out.sourcesContent).toEqual([content])
})

test('offset_script_sourcemap with no preceding lines leaves positions unchanged', () => {
	const rawMap = { mappings: encode([[[0, 0, 2, 1]]]), names: [] }
	const out = offset_script_sourcemap(rawMap, 0, 'a.svelte', 'x') as any
	const decoded = decode(out.mappings)
	expect(decoded[0][0]).toEqual([0, 0, 2, 1])
})
