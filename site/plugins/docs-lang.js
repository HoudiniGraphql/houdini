// this preprocessor is responsible for leaving 2 different code blocks behind
// the UI will hide/show the appropriate one depending on which language the user
// has selected

import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript.js'
import prettier from 'prettier'

const AST = recast.types.builders

export default {
	async markup({ content, filename }) {
		// only consider .svx files
		if (!filename.endsWith('.svx')) {
			return
		}

		// instead of getting super fancy with an AST, we're just going to
		// do operations on the string content.

		// the transformation we use depends on the matching codeblock
		const transformation = {
			typescript: transformTypescript,
			svelte: transformSvelte
		}

		// look for each language we care about
		for (const [language, transform] of Object.entries(transformation)) {
			// in order to add the codeblocks back, we need to keep track of the list
			// in reverse order (so the index is always valid)
			const newBlocks = []

			// our goal is to look for the content between ```typescript and ```
			for (const match of [...content.matchAll(new RegExp('```' + language, 'gi'))]) {
				// find the end of the codeblock
				for (let endIndex = match.index + 3; endIndex < content.length; endIndex++) {
					// look for the index where the 3 characters are ```
					if (content.slice(endIndex, endIndex + 3) !== '```') {
						continue
					}
					// we actually need to treat the block as ending 2 indices later
					endIndex += 3

					// the content of the block is between the two indices
					const blockContent = content.slice(match.index, endIndex)

					// only add something if the typescript toggle is enabled
					if (!blockContent.includes('typescriptToggle=true')) {
						break
					}

					// if the language

					// push the new block at the beginning
					newBlocks.unshift({
						index: endIndex,
						// transform the typescript source into the javascript equivalent
						block: await transform(blockContent)
					})

					// we're done processing this block
					break
				}
			}

			// now that we have the list of codeblocks, insert them into the original script
			for (const { index, block } of newBlocks) {
				content = insert(content, block, index)
			}
		}

		return {
			code: content
		}
	}
}

async function transformSvelte(content) {
	// if we have a typescript script, there's something to do
	if (content.includes('<script lang="ts">')) {
		// we need to transform the contents of the script like we do the rest of
		// our typescript samples
		const open = '<script lang="ts">'
		const close = '</script>'

		// the content that needs processing is betetween the end of the open and the start of the close
		const start = content.indexOf(open) + open.length
		const end = content.indexOf(close)

		// transform the content between the tags
		let transformed = (await transformTypescript(content.substring(start, end))).trim() + '\n'
		// the transformation needs to be indented one level
		transformed = '    ' + transformed.replaceAll('\n', '\n    ')

		// add the transformed content to the script
		content = insert(content, transformed, start, end)
			// the final closing tag needs to be outdented
			.replace('    </script>', '</script>')

		// the first thing we want to do is flag the toggle as off
		content = content.replace('typescriptToggle=true', 'typescriptToggle=false')
		// remove the lang="ts" portion
		content = content.replace(' lang="ts"', '')
	}

	return content
}

export async function transformTypescript(content) {
	// the first thing we need to do is mark this as a javascript plugin instead
	content = content.replace('```typescript', '```javascript')
	content = content.replace('.ts', '.js')
	content = content.replace('typescriptToggle=true', 'typescriptToggle=false')

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
			transformVariable(statement, statement, importSource)
		}

		// if we are looking at an exported variable, we need to transform the underlying statement
		if (statement.type === 'ExportNamedDeclaration') {
			if (statement.declaration.type === 'VariableDeclaration') {
				transformVariable(statement.declaration, statement, importSource)
			} else if (statement.declaration.type === 'FunctionDeclaration') {
				transformFunction(statement.declaration, statement, importSource)
			}
		}

		// the statement is okay to add to the list
		transformed.push(statement)
	}

	return (
		content.substring(0, start) +
		'\n' +
		format(recast.print(AST.program(transformed)).code) +
		'\n' +
		content.substring(end).trim()
	)
}

// transform a variable declaration
function transformVariable(statement, parent, importPaths) {
	if (statement.declarations[0] && statement.declarations[0].id.typeAnnotation) {
		const declaration = statement.declarations[0]

		// the type to assign to the variable
		let targetType = ''

		// dry up the type annotation reference
		const typeAnnotation = declaration.id.typeAnnotation.typeAnnotation

		// if the type it was declared as a reference to another type
		if (typeAnnotation.typeName) {
			const typeName = typeAnnotation.typeName.name
			const source = importPaths[typeName]
			targetType = `import('${source}').${typeName}`
		}
		// the type could be declared as a number
		else {
			targetType = recast.print(typeAnnotation).code
		}

		// remove the type annotation
		declaration.id.typeAnnotation = null

		parent.comments = [...(parent.comments ?? []), AST.commentBlock(`* @type { ${targetType} } `)]
	}
}

function transformFunction(statement, parent, importPaths) {
	// build up a list of the params for the function
	const params = []

	for (const param of statement.params) {
		// if the param has a type we need to add it to the list
		if (param.typeAnnotation) {
			params.push({
				name: param.name,
				type: param.typeAnnotation.typeAnnotation.typeName.name
			})

			// clear the annotation
			param.typeAnnotation = null
		}
	}

	// if we have parameters in function signature we need to build up the comment
	if (params.length > 0) {
		// create the comment
		const comment = params
			.map(
				(param) =>
					`@param { import('${importPaths[param.type]}').${param.type} } ${param.name ?? ''}`
			)
			.join('\n')

		parent.comments = [...(parent.comments ?? []), commentBlock(comment)]
	}
}

function parseJS(str) {
	return recast.parse(str || '', {
		parser: typeScriptParser
	}).program
}

function commentBlock(comment) {
	// every new line need a new line, an asterix and a space
	return AST.commentBlock('*\n * ' + comment.replaceAll('\n', '\n * ') + '\n ')
}

export function insert(str, content, start, finish = start) {
	return str.substring(0, start) + '\n' + content + str.substring(finish)
}

export function format(str) {
	return prettier.format(str, {
		tabWidth: 4,
		semi: false,
		singleQuote: true,
		printWidth: 100,
		plugins: ['prettier-plugin-svelte'],
		parser: 'babel-ts'
	})
}
