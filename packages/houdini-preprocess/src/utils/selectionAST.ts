import { SubscriptionSelection } from 'houdini'
import * as recast from 'recast'
import { namedTypes } from 'ast-types/gen/namedTypes'

const AST = recast.types.builders

export default function selectionAST(
	selection: SubscriptionSelection
): namedTypes.ObjectExpression {
	const obj = AST.objectExpression([])
	// copy every key into the obj
	for (const [field, { type, key, fields: subselection }] of Object.entries(selection)) {
		const fieldObj = AST.objectExpression([
			AST.objectProperty(AST.literal('type'), AST.stringLiteral(type)),
			AST.objectProperty(AST.literal('key'), AST.stringLiteral(key)),
		])

		// if there are fields under this one
		if (subselection) {
			fieldObj.properties.push(
				AST.objectProperty(AST.literal('fields'), selectionAST(subselection))
			)
		}

		// add the field object to the selection
		obj.properties.push(AST.objectProperty(AST.literal(field), fieldObj))
	}

	return obj
}
