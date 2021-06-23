// locals
import type { Maybe, Script } from './types'
import { parse as parseJS } from '@babel/parser'

export type ParsedSvelteFile = {
	instance: Maybe<Script>
	module: Maybe<Script>
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
		if (!script) {
			continue
		}

		result[i === 0 ? 'instance' : 'module'] = {
			content: parseJS(script.content || '', {
				plugins: ['typescript'],
				sourceType: 'module',
			}).program,
			start: script.start,
			// end has to exist to get this far
			end: script.end!,
		}
	}

	// we're done here
	return result
}

type StackElement = {
	tag: string
	attributes: { [key: string]: string }
	start: number
	end?: number
	content?: string
}

type StackElementWithStart = StackElement & { startOfTag: number }

function parse(str: string): { instance: StackElement | null; module: StackElement | null } {
	// offset the script by one so the iterator can start at index 0 pointing at the first element
	let content = str

	// we need to step through the document and find scripts that are at the root of the document
	const stack = [] as StackElementWithStart[]
	let index = -1

	let module: StackElement | null = null
	let instance: StackElement | null = null

	const pop = () => {
		const head = content.slice(0, 1)
		content = content.slice(1, content.length)
		index++
		return head
	}

	const takeTil = (char: string) => {
		let head = pop()
		let acc = head
		let tail = head

		// consume characters from content until we get something matching our target
		while (tail !== char && content.length > 0) {
			head = pop()
			acc += head
			tail = acc.substr(-char.length)
			// if we ran into the start or finish of a logic block before we continue
			if (head === '{') {
				// ignore the entire block
				takeUntilIgnoringNested('}', '{')
				continue
			}
		}

		// if the last character is not what we were looking for
		if (tail !== char) {
			throw new Error('Could not find ' + char)
		}

		return acc
	}

	const takeUntilIgnoringNested = (finish: string, start: string) => {
		// we need to count instances of `start` that we run into to find the one that closes the one we found
		let count = 1
		// the last character we saw
		let head = ''

		// we know that the head matches so eat it and keep looking
		head = pop()

		// keep eating until we found the closing `finish`
		while (count > 0 && content.length > 0) {
			// consume one character from the string
			head = pop()

			if (head === start) {
				count++
			} else if (head === finish) {
				count--
			}
		}

		// if the last character we saw was not the finishing character, there was a problem
		if (head !== finish) {
			throw new Error(`Did not encounter matching ${finish}.`)
		}
	}

	while (content.length > 0) {
		const head = pop()

		// if we found a comment
		if (head + content.substr(0, '!--'.length) === '<!--') {
			// consume the string until we are at the end of the comment
			takeTil('-->')
			// we're done
			continue
		}

		// if the character indicates the start or end of a tag
		if (head === '<') {
			// if we are inside of a script tag, we should just ignore what we found unless its a closing tag
			if (
				stack.length > 0 &&
				stack[stack.length - 1].tag === 'script' &&
				content.substr(0, '/script'.length) !== '/script'
			) {
				continue
			}

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
					const content = str.slice(start, end - 1).trim()

					// dry the result
					const script = {
						start: innerElement.startOfTag,
						end: innerElement.end + tag.length + 1,
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

			// if the last character is a / then we have a self closing tag, nothing goes on the stack
			if (tag.slice(-1) !== '/') {
				// add the tagname to the stack
				stack.push({
					tag: tagName,
					attributes,
					start: index,
					// pop increments by one, so if we are starting the tag here, we're one ahead
					startOfTag: index - tag.length - 1,
				})
			}

			// we're done processing the string
			continue
		}

		// if we ran into the start or finish of a logic block
		if (head === '{') {
			// ignore the entire block
			takeUntilIgnoringNested('}', '{')
			// keep processing the rest of the string
			continue
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
	const tag = tagName.trim()

	// only compute the attributes for scripts
	const attributes =
		tag !== 'script'
			? {}
			: str
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
		tag,
		attributes,
	}
}
