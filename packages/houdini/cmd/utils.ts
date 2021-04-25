import * as recast from 'recast'
import { ExpressionKind } from 'ast-types/gen/kinds'
import { Config } from 'houdini-common'

const AST = recast.types.builders

// vite is happpy with the export format if I take the lib/module/etc config
// and copy it into the payload used to compile on the fly, should be able
// to guide what the exports look like from there

export function moduleExport(config: Config, key: string, value: ExpressionKind) {
	// module exports in sapper should be common js
	if (config.mode === 'sapper') {
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
