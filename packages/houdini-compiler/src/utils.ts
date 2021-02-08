import * as recast from 'recast'
import { ExpressionKind } from 'ast-types/gen/kinds'
const AST = recast.types.builders

export function moduleExport(key: string, value: ExpressionKind) {
	return AST.expressionStatement(
		AST.assignmentExpression(
			'=',
			AST.memberExpression(
				AST.memberExpression(AST.identifier('module'), AST.identifier('exports')),
				AST.identifier(key)
			),
			value
		)
	)
}
