import type { Script } from 'houdini'
import { printJS, parseJS, runPipeline, formatErrors } from 'houdini'
import type { TransformPage } from 'houdini/vite'
import * as recast from 'recast'
import type { SourceMapInput } from 'rollup'

import { plugin_config } from '../config'
import { parseSvelte } from '../extract'
import { type Framework } from '../kit'
import query from './componentQuery'
import kit from './kit'
import tags from './tags'
import type { SvelteTransformPage } from './types'

// tags must be processed last so we don't lose the graphql tags we look for
// context must go last since it looks for GQL_ imports
const pipeline = [kit, query, tags]

export default async function apply_transforms(
	framework: Framework,
	page: TransformPage
): Promise<{ code: string; map?: SourceMapInput }> {
	// a single transform might need to do different things to the module and
	// instance scripts so we're going to pull them out, push them through separately,
	// and then join them back together
	let script: Script | null = null
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
			script = await parseJS(page.content)
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
	const { code, map } = await printJS(result.script, {
		// @ts-ignore
		inputSourceMap: page.map,
	})

	return {
		// if we're transforming a svelte file, we need to replace the script's inner contents
		code: !page.filepath.endsWith('.svelte')
			? code
			: replace_tag_content(page.content, position!.start, position!.end, code),
		map,
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
