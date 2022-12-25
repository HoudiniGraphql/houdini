// this preprocessor is responsible for leaving 2 different code blocks behind
// the UI will hide/show the appropriate one depending on which language the user
// has selected

import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript.js'

const AST = recast.types.builders

export default {
	async markup({ content, filename }) {
		// only consider .svx files
		if (!filename.endsWith('.svx')) {
			return
		}

		// instead of getting super fancy with an AST, we're just going to
		// do operations on the string content.

		// in order to add the codeblocks back, we need to keep track of the list
		// in reverse order (so the index is always valid)
		const newBlocks = []

		// our goal is to look for the content between ```typescript and ```
		for (const match of [...content.matchAll(new RegExp('```typescript', 'gi'))]) {
			// find the end of the codeblock
			for (let endIndex = match.index + 3; endIndex < content.length; endIndex++) {
				// look for the index where the 3 characters are ```
				if (content.slice(endIndex, endIndex + 3) !== '```') {
					continue
				}
				// we actually need to treat the block as ending 2 indices later
				endIndex += 3

				// push the new block at the beginning
				newBlocks.unshift({
					index: endIndex,
					// transform the typescript source into the javascript equivalent
					block: await transformTypescript(content.slice(match.index, endIndex))
				})

				// we're done processing this block
				break
			}
		}

		// now that we have the list of codeblocks, insert them into the original script
		let final = content
		for (const { index, block } of newBlocks) {
			final = final.substring(0, index) + '\n' + block + final.substring(index)
		}

		return {
			code: final
		}
	}
}

export async function transformTypescript(content) {
	// the first thing we need to do is mark this as a javascript plugin instead
	content = content.replace('```typescript', '```javascript')
	content = content.replace('.ts', '.js')

	// the actual source is between the first and last line break. we'll leave the first line break
	// in place so that we can use them as markers for every line in the following loop
	const start = content.indexOf('\n')
	const end = content.lastIndexOf('\n')
	const source = content.substring(start, end)

	// we're going to build up the new version as a separate list
	const transformed = []

	// keep track of every type import and where it comes from so we can add comments
	// to the javascript source
	const importSource = {}

	// loop over top level statement
	for (const statement of await parseJS(source).body) {
		// if the statement is a type import, we need to track where it came from
		// and not add it to the final result
		if (statement.type === 'ImportDeclaration' && statement.importKind === 'type') {
			let source = statement.source.value
			for (const { imported } of statement.specifiers) {
				importSource[imported.name] = source
			}
			continue
		}

		// if we are looking at a variable declaration, we need to strip the type declaration and
		// add a comment over it
		if (statement.type === 'VariableDeclaration') {
			transformDeclaration(statement, statement, importSource)
		}

		// if we are looking at an exported variable, we need to transform the underlying statement
		if (statement.type === 'ExportNamedDeclaration') {
			transformDeclaration(statement.declaration, statement, importSource)
		}

		// the statement is okay to add to the list
		transformed.push(statement)
	}

	return (
		content.substring(0, start) +
		'\n' +
		recast.print(AST.program(transformed)).code +
		'\n' +
		content.substring(end).trim()
	)
}

// transform a variable declaration
function transformDeclaration(statement, parent, importPaths) {
	if (
		statement.type === 'VariableDeclaration' &&
		statement.declarations[0] &&
		statement.declarations[0].id.typeAnnotation
	) {
		const declaration = statement.declarations[0]
		// look up the type it was declared as
		const targetType = declaration.id.typeAnnotation.typeAnnotation.typeName.name

		const source = importPaths[targetType]

		// remove the type annotation
		declaration.id.typeAnnotation = null

		parent.comments = [AST.commentBlock(` @type { import('${source}').${targetType} } `)]
	}
}

export function parseJS(str) {
	return recast.parse(str || '', {
		parser: typeScriptParser
	}).program
}
