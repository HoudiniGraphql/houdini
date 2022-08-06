import { parse as parseJavascript } from '@babel/parser'
import * as svelte from 'svelte/compiler'

import type { Maybe, Script } from './types'

export type ParsedFile = Maybe<{ script: Script; start: number; end: number }>

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

export async function parseJS(str: string): Promise<ParsedFile> {
	return {
		start: 0,
		// @ts-ignore
		script: parseJavascript(str || '', {
			plugins: ['typescript'],
			sourceType: 'module',
		}).program,
		end: str.length,
	}
}

export function findScriptInnerBounds({
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
		console.log({
			start: start,
			end: end,
			text,
			length: text.length,
			last: text[end],
		})
		throw new Error('Could not find the start of the tag close')
	}

	return [greaterThanIndex + 1, lessThanIndex]
}
