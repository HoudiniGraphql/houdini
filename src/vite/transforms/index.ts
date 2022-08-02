// externals
import * as recast from 'recast'
// locals
import { Config, parseJS, runPipeline, Transform, ParsedFile } from '../../common'
import { TransformPage } from '../plugin'
import svelteKitProccessor from './kit'
import tagProcessor from './tags'

const defaultTransforms = [svelteKitProccessor, tagProcessor]

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

	// we need to apply the changes to the file. we'll do this by printing the mutated
	// content as a string and then replacing everything between the appropriate
	// script tags. the parser tells us the locations for the different tags so we
	// just have to replace the indices it tells us to
	const printedInstance = result.script ? (recast.print(result.script).code as string) : ''

	// just copy the instance where it needs to go
	return {
		code: printedInstance,
	}
}
