import * as recast from 'recast'

import {
	Config,
	parseJS,
	runPipeline,
	Transform,
	ParsedFile,
	parseSvelte,
	findScriptInnerBounds,
	formatErrors,
} from '../../common'
import { TransformPage } from '../plugin'
import svelteKit from './kit'
import query from './query'
import tags from './tags'

// tags must be processed last so we don't lose the graphql tags we look for
const pipeline = [svelteKit, query, tags]

export default async function apply_transforms(
	config: Config,
	page: Omit<TransformPage, 'script'>,
	content: string
): Promise<{ code: string }> {
	// a single transform might need to do different things to the module and
	// instance scripts so we're going to pull them out, push them through separately,
	// and then join them back together
	let script: ParsedFile | null = null

	try {
		if (page.filepath.endsWith('.svelte')) {
			script = await parseSvelte(content)
		} else {
			script = await parseJS(content)
		}
	} catch (e) {
		console.log(page.filepath, content)
		return { code: content }
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
		return { code: content }
	}

	// wrap everything up in an object we'll thread through the transforms
	const result: TransformPage = {
		...page,
		...script,
	}

	// send the scripts through the pipeline
	try {
		await runPipeline(config, pipeline, result)
	} catch (e) {
		formatErrors({ message: (e as Error).message, filepath: page.filepath })
		return { code: content }
	}

	// if we dont have anything to render, we're done
	if (!result.script) {
		return { code: content }
	}

	// print the result
	const printedScript = recast.print(result.script).code

	return {
		// if we're transforming a svelte file, we need to replace the script's inner contents
		code: !page.filepath.endsWith('.svelte')
			? printedScript
			: replace_tag_content(content, script.start, script.end, printedScript),
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

// replaceSubstring replaces the substring string between the indices with the provided new value
const replace_between = (origin: string, startIndex: number, endIndex: number, insertion: string) =>
	origin.substring(0, startIndex) + insertion + origin.substring(endIndex)
