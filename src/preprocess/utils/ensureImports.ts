// externals
import * as recast from 'recast'
import { Statement } from '@babel/types'
// locals
import { Config } from '../../common'

const AST = recast.types.builders

export default function ensureImports(config: Config, body: Statement[], identifiers: string[]) {
	const toImport = identifiers.filter(
		(identifier) =>
			!body.find(
				(statement) =>
					statement.type === 'ImportDeclaration' &&
					statement.source.value === '$houdini' &&
					statement.specifiers.find(
						(importSpecifier) =>
							importSpecifier.type === 'ImportSpecifier' &&
							importSpecifier.imported.type === 'Identifier' &&
							importSpecifier.imported.name === identifier &&
							importSpecifier.local.name === identifier
					)
			)
	)

	// add the import if it doesn't exist, add it
	if (toImport.length > 0) {
		body.unshift({
			type: 'ImportDeclaration',
			// @ts-ignore
			source: AST.stringLiteral('$houdini'),
			// @ts-ignore
			specifiers: toImport.map((identifier) =>
				AST.importSpecifier(AST.identifier(identifier), AST.identifier(identifier))
			),
		})
	}
}
