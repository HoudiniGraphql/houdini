import type { ExpressionKind } from 'ast-types/gen/kinds'
import * as graphql from 'graphql'
import * as recast from 'recast'

import { HoudiniError } from '../../../lib'

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

	// anything else can just use its literal value
	return AST.literal(value)
}

export function deepMerge(filepath: string, ...targets: {}[]): {} {
	// look at the first target to know what type we're merging

	// if we aren't looking at an object
	if (typeof targets[0] !== 'object') {
		// make sure all of the values are the same
		const matches = targets.filter((val) => val !== targets[0]).length === 0
		if (!matches) {
			throw new HoudiniError({ filepath, message: 'could not merge: ' + targets })
		}

		// return the matching value
		return targets[0]
	}

	// if we are looking at a list of lists
	if (Array.isArray(targets[0])) {
		return (targets[0] as {}[]).concat(...targets.slice(1))
	}

	// collect all of the fields that the targets specify and map them to their value
	const fields: Record<string, any[]> = {}

	for (const target of targets) {
		// add every field of the target to the bag
		for (const [key, value] of Object.entries(target)) {
			// if we haven't seen the key before
			if (!fields[key]) {
				// save it as a list
				fields[key] = []
			}

			fields[key].push(value)
		}
	}

	return Object.fromEntries(
		Object.entries(fields).map(([key, value]) => [key, deepMerge(filepath, ...value)])
	)
}

export function convertValue(val: graphql.ValueNode) {
	// figure out the value to use
	let value
	let kind

	// the value of the arg is always going to be a
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
