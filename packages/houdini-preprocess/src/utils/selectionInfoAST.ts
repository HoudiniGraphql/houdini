import { TypeLinks } from 'houdini'
import * as recast from 'recast'
import { namedTypes } from 'ast-types/gen/namedTypes'

const AST = recast.types.builders

export default function selectionInfoAST(links: TypeLinks): namedTypes.ObjectExpression {
	return AST.objectExpression([
		AST.objectProperty(AST.literal('rootType'), AST.stringLiteral(links.rootType)),
		AST.objectProperty(
			AST.literal('fields'),
			AST.objectExpression(
				Object.entries(links.fields).map(([typeName, links]) =>
					AST.objectProperty(
						AST.literal(typeName),
						AST.objectExpression(
							Object.entries(links).map(([fieldName, { key, type }]) =>
								AST.objectProperty(
									AST.literal(fieldName),
									AST.objectExpression([
										AST.objectProperty(
											AST.literal('key'),
											AST.stringLiteral(key)
										),
										AST.objectProperty(
											AST.literal('type'),
											AST.stringLiteral(type)
										),
									])
								)
							)
						)
					)
				)
			)
		),
	])
}
