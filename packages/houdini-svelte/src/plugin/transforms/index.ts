import { parseJS, runPipeline, formatErrors } from 'houdini'
import type { TransformPage } from 'houdini/vite'
import * as recast from 'recast'
import type { SourceMapInput } from 'rollup'

import type { ParsedFile } from '../extract'
import { parseSvelte } from '../extract'
import type { Framework } from '../kit'
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
	let script: ParsedFile | null = null

	try {
		if (page.filepath.endsWith('.svelte')) {
			script = await parseSvelte(page.content)
		} else {
			script = await parseJS(page.content)
		}
	} catch (e) {
		return { code: page.content, map: page.map }
	}

	// if the route script is nill we can just use an empty program
	if (script === null) {
		script = {
			start: 0,
			end: 0,
			script: recast.types.builders.program([]),
		}
	}

	// if we didn't get a script out of this, there's nothing to do
	if (!script) {
		return { code: page.content }
	}

	// wrap everything up in an object we'll thread through the transforms
	const result: SvelteTransformPage = {
		...page,
		framework,
		...script,
	}

	// send the scripts through the pipeline
	try {
		await runPipeline(page.config, pipeline, result)
	} catch (e) {
		formatErrors({ message: (e as Error).message, filepath: page.filepath })
		return { code: page.content }
	}

	// print the result
	const { code, map } = recast.print(result.script, {
		// @ts-ignore
		inputSourceMap: page.map,
	})

	return {
		// if we're transforming a svelte file, we need to replace the script's inner contents
		code: !page.filepath.endsWith('.svelte')
			? code
			: replace_tag_content(page.content, script.start, script.end, code),
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
