import { HoudiniError, parseJS } from 'houdini'
import type { Maybe, Script } from 'houdini/types'
import * as svelte from 'svelte/compiler'

export type ParsedFile = Maybe<{ script: Script; start: number; end: number }>
export default async function (filepath: string, contents: string): Promise<string[]> {
	const documents: string[] = []

	let parsedFile: ParsedFile
	try {
		parsedFile = await parseSvelte(contents)
	} catch (e) {
		const err = e as Error

		// add the filepath to the error message
		throw new HoudiniError({
			message: `Encountered error parsing ${filepath}`,
			description: err.message,
		})
	}

	// we need to look for multiple script tags to support sveltekit
	const scripts = [parsedFile]

	await Promise.all(
		scripts.map(async (jsContent) => {
			// @ts-ignore
			// look for any template tag literals in the script body
			svelte.walk(jsContent, {
				enter(node) {
					// if we are looking at the graphql template tag
					if (
						node.type === 'TaggedTemplateExpression' &&
						// @ts-ignore
						node.tag.name === 'graphql'
					) {
						// @ts-ignore
						// parse the tag contents to get the info we need
						const printedDoc = node.quasi.quasis[0].value.raw

						documents.push(printedDoc)
					}
				},
			})
		})
	)

	// we found every document in the file
	return documents
}

export async function parseSvelte(str: string): Promise<ParsedFile> {
	// parsing a file happens in two steps:
	// - first we use svelte's parser to find the bounds of the script tag
	// - then we run the contents through babel to parse it
	const preprocessed = await svelte.preprocess(str, [
		{
			script({ content: input }) {
				return {
					code: input.replace(/\S/g, ' '),
				}
			},
			style({ content: input }) {
				return {
					code: input.replace(/\S/g, ' '),
				}
			},
		},
	])
	// parse the result to find the bounds
	const parsed = svelte.parse(preprocessed.code)

	// look at the instance and module of the parsed result to find the correct bounds
	// figure out which we're parsing
	const script = parsed.instance
	if (!script) {
		return null
	}

	// now that we have the bounds we can find the appropriate string to parse
	const [greaterThanIndex, lessThanIndex] = findScriptInnerBounds({
		start: parsed.instance!.start,
		end: parsed.instance!.end - 1,
		text: str,
	})

	const string = str.slice(greaterThanIndex, lessThanIndex)

	// we're done here
	const scriptParsed = await parseJS(string)

	return scriptParsed
		? {
				script: scriptParsed.script,
				start: greaterThanIndex,
				end: lessThanIndex,
		  }
		: null
}

function findScriptInnerBounds({
	start,
	end,
	text,
}: {
	start: number
	end: number
	text: string
}): [number, number] {
	// {start} points to the < of the opening tag, we want to find the >
	let greaterThanIndex = start
	// keep looking until the end
	while (greaterThanIndex < end) {
		// if we found the > we can stop looking
		if (text[greaterThanIndex] === '>') {
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
		if (text[lessThanIndex] === '<') {
			break
		}
		// keep looking
		lessThanIndex--
	}
	// if we didn't find it
	if (lessThanIndex === end) {
		throw new Error('Could not find the start of the tag close')
	}

	return [greaterThanIndex + 1, lessThanIndex]
}
