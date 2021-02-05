// externalsr

import * as svelte from 'svelte/compiler'
import * as recast from 'recast'
import { applyTransforms as apply, TransformPipeline } from 'houdini-compiler'
// locals
import { defaultTransforms } from './transforms'
import * as types from './types'

// export some types for others to consume
export * from './types'

// the main entry point for the preprocessor
export default function houdiniPreprocessor(config: types.PreProcessorConfig) {
	return {
		async markup({ content, filename }: { content: string; filename: string }) {
			return await applyTransforms(config, { content, filename })
		},
	}
}

export async function applyTransforms(
	config: types.PreProcessorConfig,
	doc: { content: string; filename: string },
	pipeline: TransformPipeline<types.TransformDocument> = defaultTransforms
): Promise<{ code: string; dependencies: string[] }> {
	// a single transform might need to do different things to the module and
	// instance scripts so we're going to pull them out, push them through separately,
	// and then join them back together

	// wrap the two ASTs in something we can pass through the pipeline
	const parsed = svelte.parse(doc.content)

	// wrap everything up in an object we'll thread through the transforms
	const result: types.TransformDocument = {
		instance: parsed.instance,
		module: parsed.module,
		config,
		dependencies: [],
		filename: doc.filename,
	}

	// send the scripts through the pipeline
	await apply(pipeline, result)

	// we need to apply the changes to the file. we'll do this by printing the mutated
	// content as a string and then replacing everything between the appropriate
	// script tags. the parser tells us the locations for the different tags so we
	// just have to replace the indices it tells us to
	const printedModule = result.module
		? (recast.print(result.module.content).code as string)
		: null
	const printedInstance = result.instance
		? (recast.print(result.instance.content).code as string)
		: null

	// if there is a module and no instance
	if (result.module && !result.instance && printedModule) {
		// just copy the module where it needs to go
		return {
			code: replaceTagContent(
				doc.content,
				result.module.start,
				result.module.end,
				printedModule
			),
			dependencies: result.dependencies,
		}
	}

	// if there is an instance and no module
	if (result.instance && !result.module && printedInstance) {
		// just copy the instance where it needs to go
		return {
			code: replaceTagContent(
				doc.content,
				result.instance.start,
				result.instance.end,
				printedInstance
			),
			dependencies: result.dependencies,
		}
	}

	// we know that there is a module and an instance so we printed both
	// lets make typescript happy.
	if (!result.module || !result.instance || !printedModule || !printedInstance) {
		throw new Error('Would never get here.')
	}

	// there is both a module and an instance so we want to replace the lowest
	// one first so that the first's indices stay valid after we change content

	// if the module is lower than the instance
	if (result.module.start > result.instance.start) {
		// replace the module content first
		const updatedModule = replaceTagContent(
			doc.content,
			result.module.start,
			result.module.end,
			printedModule
		)

		return {
			code: replaceTagContent(
				updatedModule,
				result.instance.start,
				result.instance.end,
				printedInstance
			),
			dependencies: result.dependencies,
		}
	}
	// the instance is lower than the module

	// replace the instance content first (so the module indices are valid)
	const updatedInstance = replaceTagContent(
		doc.content,
		result.instance.start,
		result.instance.end,
		printedInstance
	)

	// then replace the module content
	return {
		code: replaceTagContent(
			updatedInstance,
			result.module.start,
			result.module.end,
			printedModule
		),
		dependencies: result.dependencies,
	}
}

function replaceTagContent(source: string, start: number, end: number, insert: string) {
	// {start} points to the < of the opening tag, we want to find the >
	let greaterThanIndex = start
	// keep looking until the end
	while (greaterThanIndex < end) {
		// if we found the > we can stop looking
		if (source[greaterThanIndex] === '>') {
			break
		}

		// keep looking
		greaterThanIndex++
	}
	// if we didn't find it
	if (greaterThanIndex === start) {
		throw new Error('Could not find the end of the tag open')
	}

	// {end} points to the > of the closing tag
	let lessThanIndex = end
	while (lessThanIndex > greaterThanIndex) {
		// if we found the < we can stop looking
		if (source[lessThanIndex] === '<') {
			break
		}
		// keep looking
		lessThanIndex--
	}
	// if we didn't find it
	if (lessThanIndex === end) {
		throw new Error('Could not find the start of the tag close')
	}

	// replace the content between the closing of the open and open of the close
	return replaceBetween(source, greaterThanIndex + 1, lessThanIndex, insert)
}

// replaceSubstring replaces the substring string between the indices with the provided new value
const replaceBetween = (origin: string, startIndex: number, endIndex: number, insertion: string) =>
	origin.substring(0, startIndex) + insertion + origin.substring(endIndex)
