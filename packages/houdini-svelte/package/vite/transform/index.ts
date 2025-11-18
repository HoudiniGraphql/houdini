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
			script = parseJS(page.content)
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
		code: page.filepath.endsWith('.svelte')
			? replace_tag_content(page.content, position!.start, position!.end, code)
			: code,
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
