import { parse as parseJS } from '@babel/parser'
// locals
import type { Maybe, Script } from './types'

const scriptStart = '<script'
const scriptEnd = '</script>'

type ParsedSvelteFile = {
	instance: Maybe<Script>
	module: Maybe<Script>
}

export function parseFile(content: string): ParsedSvelteFile {
	// the starting object
	const doc: ParsedSvelteFile = { instance: null, module: null }

	// we need to look for the starts of script tags
	const { starts, ends }: { starts: number[]; ends: number[] } = content
		.split('')
		.reduce<{ starts: number[]; ends: number[] }>(
			(acc, _, index) => {
				// if the index represents the start of a script
				if (content.substr(index, scriptStart.length) == scriptStart) {
					return {
						...acc,
						starts: acc.starts.concat(index),
					}
				}
				// if the index represents the end of a script
				if (content.substr(index, scriptEnd.length) == scriptEnd) {
					return {
						...acc,
						ends: acc.ends.concat(index + scriptEnd.length - 1),
					}
				}

				// keep looking
				return acc
			},
			{ starts: [], ends: [] }
		)

	// sort the indices and zip them together to create the pairs we need
	starts.sort((a, b) => (a > b ? 1 : -1))
	ends.sort((a, b) => (a > b ? 1 : -1))
	const tags = starts.map((value, index) => ({ start: value, end: ends[index] }))

	// look at every script tag we found
	for (const { start, end } of tags) {
		// figure out the attributes of the tag
		const [attributes, endOfAttributes] = findAttributes(content, start)
		const startOfContent = endOfAttributes + 1
		// the file contents live between the end of the tag and the start of the closing tag
		const scriptEndIndex = end - startOfContent - scriptEnd.length
		const scriptContents = content.substr(startOfContent, scriptEndIndex).trim()

		// parse the script contents
		const script = {
			content: parseJS(scriptContents, {
				plugins: ['typescript'],
				sourceType: 'module',
			}).program,
			start,
			end: end,
		}

		// if we are looking at the module
		if (attributes.context === 'module') {
			doc.module = script
		} else {
			doc.instance = script
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

				// JSON.parse accepts double quotes only, not single quote
				const safeValue = value.replace(/'/g, '"')

				return {
					key: key[0] === '"' ? JSON.parse(key) : key,
					value: JSON.parse(safeValue),
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
