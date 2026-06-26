import { decode, encode, type SourceMapSegment } from '@jridgewell/sourcemap-codec'
import type { Script, TransformPage } from 'houdini'
import { printJS, parseJS } from 'houdini'
import { runPipeline, formatErrors } from 'houdini'
import * as recast from 'recast'
import type { SourceMapInput } from 'rollup'

import { plugin_config } from '../config.js'
import { parseSvelte } from '../parse.js'
import type { SvelteTransformPage, Framework } from '../types.js'
import init from './init.js'
import session from './session.js'
import tags from './tags.js'

// tags must be processed last so we don't lose the graphql tags we look for
// context must go last since it looks for GQL_ imports
const pipeline = [session, init, tags]

export default async function apply_transforms(
	framework: Framework,
	page: TransformPage
): Promise<{ code: string; map?: SourceMapInput }> {
	// a single transform might need to do different things to the module and
	// instance scripts so we're going to pull them out, push them through separately,
	// and then join them back together
	let script: Script
	let position: { start: number; end: number } | null = null
	let useRunes = false

	try {
		if (page.filepath.endsWith('.svelte')) {
			const res = await parseSvelte(page.content, plugin_config(page.config).forceRunesMode)
			if (res) {
				script = res.script
				position = res.position
				useRunes = res.useRunes
			} else {
				// if the route script is nill we can just use an empty program
				script = recast.types.builders.program([])
				position = { start: 0, end: 0 }
			}
		} else {
			// pass the filepath so recast names the map's source (set up by printJS below)
			script = parseJS(page.content, undefined, page.filepath)
		}
	} catch (e) {
		return { code: page.content, map: page.map }
	}

	// wrap everything up in an object we'll thread through the transforms
	const result: SvelteTransformPage = {
		...page,
		framework,
		script,
		svelte5Runes: useRunes,
	}

	// send the scripts through the pipeline
	try {
		await runPipeline(page.config, pipeline, result)
	} catch (e) {
		formatErrors({ message: (e as Error).message, filepath: page.filepath })
		return { code: page.content }
	}

	// print the result
	if (page.filepath.endsWith('.svelte')) {
		const { code: scriptCode, map: rawMap } = await printJS(result.script)

		// The script was extracted from inside the .svelte file, so recast's positions are
		// relative to the script content (0-indexed), not the full file. Offset BOTH the
		// generated and original line numbers by the number of lines before the <script> tag
		// so the map references positions inside the full .svelte file. (The previous version
		// only shifted the generated side, leaving original positions off by the same amount.)
		let map: SourceMapInput | undefined
		if (rawMap) {
			const linesBefore = page.content.slice(0, position!.start).split('\n').length - 1
			const mapObj =
				typeof (rawMap as any).toJSON === 'function' ? (rawMap as any).toJSON() : rawMap
			map = offset_script_sourcemap(mapObj, linesBefore, page.filepath, page.content)
		}

		return {
			code: replace_tag_content(page.content, position!.start, position!.end, scriptCode),
			map,
		}
	}

	const { code, map } = await printJS(result.script, {
		// @ts-ignore
		inputSourceMap: page.map,
	})
	return { code, map }
}

// offset_script_sourcemap rewrites a source map generated for a .svelte file's extracted
// <script> content so it lines up with the full file: every generated line and every original
// line moves down by the number of lines before the <script> tag, and the source is named for
// the .svelte file. Shifting both sides (not just the generated one) is what keeps stack traces
// and breakpoints on the correct lines inside the script.
export function offset_script_sourcemap(
	rawMap: { mappings: string; names?: string[] },
	linesBefore: number,
	filepath: string,
	content: string
): SourceMapInput {
	const decoded = decode(rawMap.mappings)
	for (const line of decoded) {
		for (const segment of line) {
			// segment = [genColumn, sourceIndex, originalLine, originalColumn, nameIndex];
			// originalLine (index 2) is absolute after decode, so bump it into file space.
			if (segment.length >= 4) {
				;(segment as number[])[2] += linesBefore
			}
		}
	}
	// prepend empty generated lines so generated positions also reference the full file
	const generatedShift: SourceMapSegment[][] = Array.from({ length: linesBefore }, () => [])
	return {
		version: 3,
		sources: [filepath],
		sourcesContent: [content],
		names: rawMap.names ?? [],
		mappings: encode([...generatedShift, ...decoded]),
	}
}

function replace_tag_content(source: string, start: number, end: number, insert: string) {
	// if we're supposed to insert the tag
	if (start === 0 && end === 0) {
		// just add the script at the start
		return `<script>${insert}</script>${source}`
	}

	// replace the content between the closing of the open and open of the close
	return replace_between(source, start, end, insert)
}

const replace_between = (origin: string, startIndex: number, endIndex: number, insertion: string) =>
	origin.substring(0, startIndex) + insertion + origin.substring(endIndex)
