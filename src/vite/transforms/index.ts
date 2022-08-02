// externals
import * as recast from 'recast'
// locals
import {
	Config,
	findScriptInnerBounds,
	parseSvelte,
	parseJS,
	runPipeline,
	Transform,
	ParsedFile,
} from '../../common'
import { TransformContext } from '../plugin'
import svelteKitProccessor from './kit'
import tagProcessor from './tags'

const defaultTransforms = [svelteKitProccessor, tagProcessor]

export default async function applyTransforms(
	config: Config,
	ctx: Omit<TransformContext, 'program'>,
	content: string,
	pipeline: Transform<TransformContext>[] = defaultTransforms
): Promise<{ code: string }> {
	// a single transform might need to do different things to the module and
	// instance scripts so we're going to pull them out, push them through separately,
	// and then join them back together
	let script: ParsedFile | null = null
	try {
		script = ctx.filepath.endsWith('.svelte')
			? await parseSvelte(content)
			: await parseJS(content)
	} catch (e) {
		console.log(e)
		return { code: content }
	}

	// if we didn't get a script out of this, there's nothing to do
	if (!script) {
		return { code: content }
	}

	// wrap everything up in an object we'll thread through the transforms
	const result: TransformContext = {
		...ctx,
		program: script,
	}

	// send the scripts through the pipeline
	await runPipeline(config, pipeline, result)

	// if we dont have anything to render, we're done
	if (!result.program) {
		return { code: content }
	}

	// we need to apply the changes to the file. we'll do this by printing the mutated
	// content as a string and then replacing everything between the appropriate
	// script tags. the parser tells us the locations for the different tags so we
	// just have to replace the indices it tells us to
	const printedInstance = result.program
		? (recast.print(result.program.content).code as string)
		: ''

	// just copy the instance where it needs to go
	return {
		code: ctx.filepath.endsWith('.svelte')
			? replaceTagContent(content, result.program.start, result.program.end, printedInstance)
			: printedInstance,
	}
}

function replaceTagContent(source: string, start: number, end: number, insert: string) {
	// if we're supposed to insert the tag
	if (start === 0 && end === 0) {
		// just add the script at the start
		return `<script$>${insert}</script>${source}`
	}

	const [greaterThanIndex, lessThanIndex] = findScriptInnerBounds({
		start,
		end,
		text: source,
	})

	// replace the content between the closing of the open and open of the close
	return replaceBetween(source, greaterThanIndex, lessThanIndex, insert)
}

// replaceSubstring replaces the substring string between the indices with the provided new value
const replaceBetween = (origin: string, startIndex: number, endIndex: number, insertion: string) =>
	origin.substring(0, startIndex) + insertion + origin.substring(endIndex)
