import * as recast from 'recast'
import { ExpressionKind } from 'ast-types/gen/kinds'
const AST = recast.types.builders

export function moduleExport(key: string, value: ExpressionKind) {
	// the thing to assing
	let target = AST.memberExpression(AST.identifier('module'), AST.identifier('exports'))
	if (key !== 'default') {
		target = AST.memberExpression(target, AST.identifier(key))
	}

	return AST.expressionStatement(AST.assignmentExpression('=', target, value))
}
