import * as recast from 'recast'

import { Config, parseJS, runPipeline, Transform, ParsedFile } from '../../common'
import { TransformPage } from '../plugin'
import tagProcessor from './tags'
import svelteKitProcessor from './kit'
import queryProcessor from './query'

// tagProcessor must go last so we don't lose the graphql tags we look for
const defaultTransforms = [svelteKitProcessor, queryProcessor, tagProcessor]

export default async function applyTransforms(
	config: Config,
	page: Omit<TransformPage, 'script'>,
	content: string,
	pipeline: Transform<TransformPage>[] = defaultTransforms
): Promise<{ code: string }> {
	// a single transform might need to do different things to the module and
	// instance scripts so we're going to pull them out, push them through separately,
	// and then join them back together
	let script: ParsedFile | null = null

	try {
		script = await parseJS(content)
	} catch (e) {
		console.log(e, content)
		return { code: content }
	}

	// if we didn't get a script out of this, there's nothing to do
	if (!script) {
		return { code: content }
	}

	// wrap everything up in an object we'll thread through the transforms
	const result: TransformPage = {
		...page,
		script,
	}

	// send the scripts through the pipeline
	try {
		await runPipeline(config, pipeline, result)
	} catch (e) {
		console.log(e)
		return { code: content }
	}

	// if we dont have anything to render, we're done
	if (!result.script) {
		return { code: content }
	}

	// print the result
	return recast.print(result.script)
}
