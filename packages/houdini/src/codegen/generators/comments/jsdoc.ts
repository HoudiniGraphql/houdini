import * as recast from 'recast'

const AST = recast.types.builders
export function jsdocComment(text: string, deprecated?: string) {
	let commentContent = `*\n * ${text}\n`
	if (deprecated) {
		commentContent = `${commentContent} * @deprecated ${deprecated}\n`
	}
	return AST.commentBlock(commentContent, true)
}
