import { parse as parseJS } from '@babel/parser'
// locals
import type { Maybe, Script } from './types'

import { parse, preprocess } from 'svelte/compiler'

const scriptEnd = '</script>'

type ParsedSvelteFile = {
	instance: Maybe<Script>
	module: Maybe<Script>
}

export async function parseFile(content: string): Promise<ParsedSvelteFile> {
	// the starting object
	const doc: ParsedSvelteFile = { instance: null, module: null }

	const parsed = parse(content)

	// find the content bounds for both contexts
	for (const type of ['instance', 'module'] as ('instance' | 'module')[]) {
		const script = parsed[type]
		if (script) {
			// the start and end field here include the tag declarations which we want to ignore
			const { start, end } = script

			// find the specific context we were asked for
			const contextContent = content.slice(start, end)

			// find the index where content starts
			let startOfContent = contextContent.indexOf('>') + 1

			// figure out the index for the last character with content
			let endOfContents = contextContent.length - scriptEnd.length - 1

			// the amount of white space on the right side of the script (to do a trim() with substr)
			const rightSpacing = content.length - content.trimRight().length

			doc[type] = {
				// only consider the content in the specific context for this type
				content: parseJS(contextContent.slice(startOfContent, endOfContents), {
					plugins: ['typescript'],
					sourceType: 'module',
				}).program,
				start: start,
				end: end - scriptEnd.length + rightSpacing - 1,
			}
		}
	}

	return doc
}
