// locals
import type { Maybe, Script } from './types'
import * as svelte from 'svelte/compiler'
import { parse as parseJS } from '@babel/parser'

export type ParsedSvelteFile = {
	instance: Maybe<Script>
	module: Maybe<Script>
}

export async function parseFile(str: string): Promise<ParsedSvelteFile> {
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

	// build up the result
	const result: ParsedSvelteFile = { instance: null, module: null }

	// look at the instance and module of the parsed result to find the correct bounds
	for (const which of ['instance', 'module'] as ('instance' | 'module')[]) {
		// figure out which we're parsing
		const script = parsed[which]!
		if (!script) {
			continue
		}

		// now that we have the bounds we can find the appropriate string to parse
		const [greaterThanIndex, lessThanIndex, lang] = findScriptInnerBoundsAndLang({
			start: parsed[which]!.start,
			end: parsed[which]!.end - 1,
			text: str,
		})

		const string = str.slice(greaterThanIndex, lessThanIndex)

		result[which] = {
			// @ts-ignore
			content: parseJS(string || '', {
				plugins: ['typescript'],
				sourceType: 'module',
			}).program,
			start: parsed[which]!.start,
			// end has to exist to get this far
			end: parsed[which]!.end! - 1,
			lang,
		}
	}

	// we're done here
	return result
}

export function findScriptInnerBoundsAndLang({
	start,
	end,
	text,
}: {
	start: number
	end: number
	text: string
}): [number, number, 'js' | 'ts'] {
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

	// the <script lang="ts">
	const scriptLine = text.slice(0, greaterThanIndex + 1)
	let lang: 'js' | 'ts' = 'js'

	// Check the different know syntaxes for the lang attribute
	// And if we find typescript, well, we'll set it
	if (
		scriptLine.includes(`lang="ts"`) ||
		scriptLine.includes(`lang='ts'`) ||
		scriptLine.includes(`lang=ts`)
	) {
		lang = 'ts'
	}
	return [greaterThanIndex + 1, lessThanIndex, lang]
}
