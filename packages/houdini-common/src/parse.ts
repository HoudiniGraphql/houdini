import { parse as parseJS } from '@babel/parser'
import * as recast from 'recast'
// locals
import type { Maybe, Script } from './types'

import { parse } from 'svelte/compiler'

const scriptStart = '<script'
const scriptEnd = '</script>'

type ParsedSvelteFile = {
	instance: Maybe<Script>
	module: Maybe<Script>
}

export function parseFile(content: string): ParsedSvelteFile {
	// the starting object
	const doc: ParsedSvelteFile = { instance: null, module: null }

	const parsed = parse(content)

	for (const type of ['instance', 'module']) {
		const script = parsed[type as 'instance' | 'module']
		if (script) {
			const { start, end } = script.content as Script
			const scriptContents = content.substr(start, end - start).trim()

			doc[type as 'instance' | 'module'] = {
				content: parseJS(scriptContents, {
					plugins: ['typescript'],
					sourceType: 'module',
				}).program,
				start,
				end,
			}
		}
	}

	return doc
}

function findAttributes(content: string, start: number): [{ [key: string]: any }, number] {
	// start points to the beginning of a string, we want everything between the first space and the first > that we encounter
	let attributeString = ''
	let endIndex = start
	let found = false

	for (let index = start + scriptStart.length; index < content.length; index++) {
		// if we are looking at the >
		if (content[index] === '>') {
			found = true
			endIndex = index + 1
			// we're done
			break
		}

		// we didn't find the close so keep eating
		attributeString += content[index]
	}
	if (!found) {
		throw new Error('Did not find end of script tag')
	}

	// the attribute string follows a form of {key}={value} separated by arbitrary whitespace
	return [
		attributeString
			.trim()
			.replace(/\n/g, ' ')
			.split(/\s/)
			.filter(Boolean)
			.map((pair) => {
				// attributes are defined with an equal
				const [key, value] = pair.split('=')

				return {
					key: key[0] === '"' ? JSON.parse(key) : key,
					// JSON.parse accepts double quotes only, not single quote
					value: JSON.parse(value.replace(/'/g, '"')),
				}
			})
			.reduce<{ [key: string]: any }>(
				(acc, pair) => ({
					...acc,
					[pair.key]: pair.value,
				}),
				{}
			),
		endIndex,
	]
}
