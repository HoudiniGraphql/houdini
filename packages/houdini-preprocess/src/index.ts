// externals
import * as svelte from 'svelte/compiler'
import { Script } from 'svelte/types/compiler/interfaces'
import * as recast from 'recast'
import { applyTransforms as apply, TransformPipeline } from 'houdini-compiler'
// locals
import { defaultTransforms } from './transforms'
import * as types from './types'
// export some types for others to consume
export * from './types'

export default function houdiniPreprocessor(config: types.PreProcessorConfig) {
	return {
		async markup({ content, filename }: { content: string; filename: string }) {
			return {
				code: await applyTransforms(config, { content, filename }),
			}
		},
	}
}

export async function applyTransforms(
	config: types.PreProcessorConfig,
	doc: { content: string; filename: string },
	pipeline: TransformPipeline<types.TransformDocument> = defaultTransforms
): Promise<string> {
	// a single transform might need to do different things to the module and
	// instance scripts so we're going to pull them out, push them through separately,
	// and then join them back together

	// wrap the two ASTs in something we can pass through the pipeline
	const result: { instance: types.Maybe<Script>; module: types.Maybe<Script> } = svelte.parse(
		doc.content
	)

	// send the scripts through the pipeline
	apply(pipeline, { ...result, config })

	// we need to apply the changes to the file. we'll do this by printing the mutated
	// content as a string and then replacing everything between the appropriate
	// script tags. the parser tells us the locations for the different tags so we
	// just have to replace the indices it tells us to

	const printedModule = result.module ? recast.print(result.module.content).code : null
	const printedInstance = result.instance ? recast.print(result.instance.content).code : null

	// if there is a module and no instance
	if (result.module && !result.instance) {
		// just copy the module where it needs to go
		return replaceBetween(
			doc.content,
			result.module.start,
			result.module.end,
			printedModule as string
		)
	}

	// if there is an instance and no module
	if (result.instance && !result.module) {
		// just copy the instance where it needs to go
		return replaceBetween(
			doc.content,
			result.instance.start,
			result.instance.end,
			printedInstance as string
		)
	}

	// there is both a module and an instance so we want to replace the lowest
	// one first so that the first's indices stay valid after we change content

	// if the m

	return ''
}

// replaceSubstring replaces the substring string between the indices with the provided new value
const replaceBetween = (origin: string, startIndex: number, endIndex: number, insertion: string) =>
	origin.substring(0, startIndex) + insertion + origin.substring(endIndex)
