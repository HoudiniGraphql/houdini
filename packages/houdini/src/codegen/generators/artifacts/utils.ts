import type { ExpressionKind } from 'ast-types/lib/gen/kinds'
import * as graphql from 'graphql'
import * as recast from 'recast'

import type { Config } from '../../../lib'

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
					AST.objectProperty(AST.stringLiteral(key), serializeValue(value))
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

	// anything else can just use its literal value
	return AST.literal(value)
}

export function convertValue(config: Config, val: graphql.ValueNode) {
	// figure out the value to use
	let value
	let kind

	// the value of the arg is always going to be a scalar
	if (val.kind === graphql.Kind.INT) {
		value = parseInt(val.value, 10)
		kind = 'Int'
	} else if (val.kind === graphql.Kind.FLOAT) {
		value = parseFloat(val.value)
		kind = 'Float'
	} else if (val.kind === graphql.Kind.BOOLEAN) {
		value = val.value
		kind = 'Boolean'
	} else if (val.kind === graphql.Kind.VARIABLE) {
		value = val.name.value
		kind = 'Variable'
	} else if (val.kind === graphql.Kind.STRING) {
		value = val.value
		kind = 'String'
	}

	return { kind, value }
}
