import * as recast from 'recast'
import { ExpressionKind } from 'ast-types/gen/kinds'

const AST = recast.types.builders

export function serializeValue(value: any): ExpressionKind {
	// if we are serializing a list
	if (Array.isArray(value)) {
		// return an array expression with every element serialize
		return AST.arrayExpression(value.map(serializeValue))
	}

	// if we are serializing an object
	if (typeof value === 'object' && value !== null) {
		return AST.objectExpression(
			Object.entries(value)
				.filter(([, value]) => typeof value !== 'undefined')
				.map(([key, value]) =>
					AST.objectProperty(AST.identifier(key), serializeValue(value))
				)
		)
	}

	// if we are serializing a string
	if (typeof value === 'string') {
		// if there are new lines, use a template. otherwise, just use a string
		if (value.indexOf('\n') !== -1) {
			return AST.templateLiteral(
				[AST.templateElement({ raw: value, cooked: value }, true)],
				[]
			)
		}
		return AST.stringLiteral(value)
	}

	// if we are serializing a number
	if (typeof value === 'number') {
		return AST.literal(value)
	}

	if (value === null) {
		return AST.nullLiteral()
	}

	throw new Error('Could not serialize: ' + JSON.stringify(value))
}
