import { parseJS, find_graphql } from 'houdini'
import type { Config, Maybe, Script } from 'houdini'
import * as svelte from 'svelte/compiler'

export default async function ({
	config,
	content,
}: {
	config: Config
	content: string
}): Promise<string[]> {
	const documents: string[] = []
	let parsedFile = await parseSvelte(content)
	if (!parsedFile) {
		return documents
	}

	const { script } = parsedFile

	// look for graphql documents like normal
	await find_graphql(config, script, {
		tag({ tagContent }) {
			documents.push(tagContent)
		},
	})

	// we found every document in the file
	return documents
}

type EmbeddedScript = {
	script: Script
	position: {
		start: number
		end: number
	}
}

export async function parseSvelte(str: string): Promise<Maybe<EmbeddedScript>> {
	// parsing a file happens in two steps:
	// - first we use svelte's parser to find the bounds of the script tag
	// - then we run the contents through babel to parse it

	// remove generics from script tag — otherwise svelte preprocessor will fail to parse
	// if the generics attribute contains angle brackets
	// Input:  <script lang="ts" generics="T extends Record<string, unknown>">
	// Output: <script lang="ts"                                             >
	str = str.replace(/(<script[^>]*)(\s+)(generics="[^"]+?")/, (_, $1, $2, $3) => {
		return $1 + $2 + ' '.repeat($3.length)
	})

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

	return {
		script: scriptParsed,
		position: {
			start: greaterThanIndex,
			end: lessThanIndex,
		},
	}
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
