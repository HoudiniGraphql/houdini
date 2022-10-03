import type { ExpressionKind } from 'ast-types/gen/kinds'
import * as recast from 'recast'

import { Config } from '../../lib'

const AST = recast.types.builders

export function moduleExport(config: Config, key: string, value: ExpressionKind) {
	// make sure we use valid commonjs if necessary
	if (config.module === 'commonjs') {
		// the thing to assign
		let target = AST.memberExpression(AST.identifier('module'), AST.identifier('exports'))
		if (key !== 'default') {
			target = AST.memberExpression(target, AST.identifier(key))
		}

		return AST.expressionStatement(AST.assignmentExpression('=', target, value))
	}

	return key === 'default'
		? AST.exportDefaultDeclaration(value)
		: AST.exportNamedDeclaration(
				AST.variableDeclaration('const', [
					AST.variableDeclarator(AST.identifier(key), value),
				])
		  )
}
