// locals
import type { Maybe, Script } from './types'
import { parse as parseJS } from '@babel/parser'

type ParsedSvelteFile = {
	instance: Maybe<Script>
	module: Maybe<Script>
}

type StackElement = {
	tag: string
	attributes: { [key: string]: string }
	start: number
	end?: number
	content?: string
}

export function parseFile(str: string): ParsedSvelteFile {
	// look for the instance and module scripts
	const { instance, module } = parse(str)

	// build up the result
	const result: ParsedSvelteFile = {
		instance: null,
		module: null,
	}

	// parse both of the scripts
	for (const [i, script] of [instance, module].entries()) {
		// figure out which we're parsing
		if (!script || !script.content) {
			continue
		}

		result[i === 0 ? 'instance' : 'module'] = {
			content: parseJS(script.content, {
				plugins: ['typescript'],
				sourceType: 'module',
			}).program,
			start: script.start,
			end: script.end!,
		}
	}

	// we're done here
	return result
}

function parse(str: string): { instance: StackElement | null; module: StackElement | null } {
	let content = str

	// we need to step through the document and find scripts that are at the root of the document
	const stack = [] as StackElement[]
	let index = 0

	let module: StackElement | null = null
	let instance: StackElement | null = null

	const pop = () => {
		index++
		const head = content.slice(1, 2)
		content = content.substr(1)
		return head
	}

	const takeTil = (char: string) => {
		let head = pop()
		let acc = head
		while (head !== char && content.length > 0) {
			head = pop()
			acc += head
		}

		// if the last character is not what we were looking for
		if (acc[acc.length - 1] !== char) {
			throw new Error('Could not find ' + char)
		}

		return acc
	}

	while (content.length > 0) {
		// pull out the head of the string
		const head = pop()

		// if the character indicates the start or end of a tag
		if (head === '<') {
			// collect everything until the closing >
			let tag = takeTil('>').slice(0, -1).trim()

			// if the first character denotes we're actually closing a tag
			if (tag[0] === '/') {
				// remove the last element from the stack
				const innerElement = stack.pop()
				const tagName = tag.substr(1)
				if (!innerElement || innerElement.tag !== parseTag(tagName).tag) {
					throw new Error(
						`Encountered unexpected closing tag ${parseTag(tagName).tag}, expected ${
							innerElement?.tag
						}.`
					)
				}

				//  the index is the end of the tag
				innerElement.end = index - innerElement.tag.length - 2

				// if we ended a script that's at the top of the stack
				if (innerElement.tag === 'script' && stack.length === 0) {
					// dry the bounds
					const start = innerElement.start + 1
					const end = innerElement.end

					// get the content of the script
					const content = str.slice(start, end).trim()

					// dry the result
					const script = {
						start,
						end,
						content,
						tag: innerElement.tag,
						attributes: innerElement.attributes,
					}

					// if we are looking at the module context
					if (innerElement.attributes.context === 'module') {
						module = script
					} else {
						instance = script
					}
				}

				// keep moving
				continue
			}

			// look at the rest of the
			const { tag: tagName, attributes } = parseTag(tag)

			// add the tagname to the stack
			stack.push({
				tag: tagName,
				attributes,
				start: index,
			})
		}
	}

	return { instance, module }
}

const parseTag = (str: string) => {
	// the first characters before a space gives us the name of the tag
	let endOfTagName = str.indexOf(' ')
	if (endOfTagName === -1) {
		endOfTagName = str.length - 1
	}
	const tagName = str.substr(0, endOfTagName + 1)
	const attributes = str
		.slice(endOfTagName + 1)
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
		)

	return {
		tag: tagName.trim(),
		attributes,
	}
}
