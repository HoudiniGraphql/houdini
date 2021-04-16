import * as recast from 'recast'
import { ExpressionKind } from 'ast-types/gen/kinds'
const AST = recast.types.builders

export function moduleExport(key: string, value: ExpressionKind) {
	// the thing to assign
	let target = AST.memberExpression(AST.identifier('module'), AST.identifier('exports'))
	if (key !== 'default') {
		target = AST.memberExpression(target, AST.identifier(key))
	}

	return key === 'default'
		? AST.exportDefaultDeclaration(value)
		: AST.exportNamedDeclaration(
				AST.variableDeclaration('const', [
					AST.variableDeclarator(AST.identifier(key), value),
				])
		  )
}
