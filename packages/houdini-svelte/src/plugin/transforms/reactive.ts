import { walk } from 'estree-walker'
import type { Config } from 'houdini'
import * as recast from 'recast'

import { is_component, is_route } from '../kit'
import type { SvelteTransformPage } from './types'

const AST = recast.types.builders

type VariableDeclaration = recast.types.namedTypes.VariableDeclaration
type VariableDeclarator = recast.types.namedTypes.VariableDeclarator
type CallExpression = recast.types.namedTypes.CallExpression
type TaggedTemplateExpression = recast.types.namedTypes.TaggedTemplateExpression

export default async function ReactiveProcessor(config: Config, page: SvelteTransformPage) {
	// if a file imports graphql from $houdini then they might have an inline document
	// that needs to be transformed into a reactive statement.
	// in order to avoid situations where graphql is passed around to functions we are going to
	// look for graphql being passed specifically to a function that matches some list
	// being used as an assignment
	if (
		!is_component(config, page.framework, page.filepath) &&
		!is_route(config, page.framework, page.filepath)
	) {
		return
	}

	// look for the list of magic functions the user has imported
	const magicFunctions = ['graphql', 'fragment', 'paginatedFragment']

	// if they didn't import graphql and at least something else, there's nothing to do
	if (!magicFunctions.includes('graphql') || magicFunctions.length === 1) {
		return
	}

	// now we have to transform any variable declarations that aren't already
	walk(page.script, {
		enter(node) {
			// we are looking for variable declarations
			if (node.type !== 'VariableDeclaration') {
				return
			}
			const expr = node as VariableDeclaration

			// we only care about declarations whose value is a call expression
			if (
				expr.declarations.length !== 1 ||
				expr.declarations[0].type !== 'VariableDeclarator'
			) {
				return
			}
			const declaration = expr.declarations[0] as VariableDeclarator
			const value = declaration.init
			if (!value) {
				return
			}

			// call expressions
			if (value.type === 'CallExpression') {
				if (!filterCallExpr(value)) {
					return
				}
			} else if (value.type === 'TaggedTemplateExpression') {
				if (!filterTaggedTemplate(value)) {
					return
				}
			} else {
				return
			}

			// we need to remove the type annotation from the id because it conflicts with
			// the reactive statement
			if (declaration.id.type === 'Identifier') {
				declaration.id.typeAnnotation = null
			}

			// if we got this far then we have a declaration of an inline document so
			// we need to replace it with a reactive statement that recreates it
			this.replace(
				AST.labeledStatement(
					AST.identifier('$'),
					AST.expressionStatement(AST.assignmentExpression('=', declaration.id, value))
				)
			)
		},
	})
}

function filterCallExpr(expr: CallExpression) {
	if (expr.type !== 'CallExpression' || expr.callee.type !== 'Identifier') {
		// the right hand side of the declaration has to be a call expression
		// that matches a magic function that was imported from the runtime
		return
	}

	// if the name of the function is 'graphql' then we should look for a string or
	// template literal
	if (
		expr.callee.type === 'Identifier' &&
		expr.callee.name === 'graphql' &&
		expr.arguments.length === 1 &&
		(expr.arguments[0].type === 'StringLiteral' || expr.arguments[0].type === 'TemplateLiteral')
	) {
		return true
	}

	// one of the arguments to the function must be a tagged template literal
	// with the graphql tag or a function named graphql with a string or template
	// literal
	const tag = expr.arguments.find(
		(arg) =>
			// if one of the arguments is a graphql template tag
			(arg.type === 'TaggedTemplateExpression' &&
				arg.tag.type === 'Identifier' &&
				arg.tag.name === 'graphql') ||
			// or an graphql function with a string or template literal
			(arg.type === 'CallExpression' &&
				arg.callee.type === 'Identifier' &&
				arg.callee.name === 'graphql' &&
				arg.arguments.length === 1 &&
				(arg.arguments[0].type === 'StringLiteral' ||
					arg.arguments[0].type === 'TemplateLiteral'))
	)
	if (!tag) {
		return
	}

	return true
}

function filterTaggedTemplate(expr: TaggedTemplateExpression) {
	// one of the arguments to the function must be a tagged template literal
	// with the graphql tag
	return (
		expr.type === 'TaggedTemplateExpression' &&
		expr.tag.type === 'Identifier' &&
		expr.tag.name === 'graphql'
	)
}
