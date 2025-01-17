import { VariableDeclarationKind } from 'ast-types/lib/gen/kinds'
import { walk } from 'estree-walker'
import { find_exported_fn, find_insert_index, ensure_imports } from 'houdini/vite'
import * as recast from 'recast'

import { is_root_layout_script, is_root_layout_server } from '../../kit'
import type { SvelteTransformPage } from '../types'

const AST = recast.types.builders

type ReturnStatement = recast.types.namedTypes.ReturnStatement
type BlockStatement = recast.types.namedTypes.BlockStatement
type Identifier = recast.types.namedTypes.Identifier
type ObjectExpression = recast.types.namedTypes.ObjectExpression
type CallExpression = recast.types.namedTypes.CallExpression
type VariableDeclaration = recast.types.namedTypes.VariableDeclaration
type VariableDeclarator = recast.types.namedTypes.VariableDeclarator

export default function (page: SvelteTransformPage) {
	if (is_root_layout_server(page.config, page.filepath)) {
		process_root_layout_server(page)
	} else if (is_root_layout_script(page.config, page.filepath)) {
		process_root_layout_script(page)
	}
}

// the root layout server file (src/routes/+layout.server.js) needs to define a load that's accessible
// to all routes that adds the session set in the application's hook file along with any existing values
// This is done in three steps:
// - define a load if there isn't one
// - set the current return value to some internal name
// - add a new return statement that includes the session data from event.locals
function process_root_layout_server(page: SvelteTransformPage) {
	const build_session_object = ensure_imports({
		script: page.script,
		config: page.config,
		import: ['buildSessionObject'],
		sourceModule: '$houdini/plugins/houdini-svelte/runtime/session',
	}).ids[0]

	add_load_return(page, (event_id) => [
		AST.spreadElement(AST.callExpression(build_session_object, [event_id])),
	])
}

// all we need to do is make sure the session gets passed down by
// threading the value through the return
function process_root_layout_script(page: SvelteTransformPage) {
	add_load_return(page, (event_id) => [
		AST.spreadElement(AST.memberExpression(event_id, AST.identifier('data'))),
	])
}

function add_load_return(
	page: SvelteTransformPage,
	properties: (id: Identifier) => ObjectExpression['properties']
) {
	modify_load(page, (body, event_id) => {
		// we have a load function and `event` is guaranteed to resolve correctly

		// now we need to find the return statement and replace it with a local variable
		// that we will use later
		let return_statement_index = body.body.findIndex(
			(statement) => statement.type === 'ReturnStatement'
		)
		let return_statement: ReturnStatement
		if (return_statement_index !== -1) {
			return_statement = body.body[return_statement_index] as ReturnStatement
		}
		// there was no return statement so its safe to just push one at the end that sets an empty
		// object
		else {
			return_statement = AST.returnStatement(AST.objectExpression([]))
			body.body.push(return_statement)
		}

		// now we need to walk through the body and replace any returns with one
		// that has the additional information mixed in
		return walk(body, {
			enter(node) {
				if (node.type === 'ReturnStatement') {
					// replace the return statement with a new one that includes the returned value
					const returnedValue = (node as ReturnStatement).argument
					this.replace(
						AST.returnStatement(
							AST.objectExpression([
								...properties(event_id),
								AST.spreadElement(returnedValue ?? AST.objectExpression([])),
							])
						)
					)
				}
			},
		}) as BlockStatement
	})
}

function modify_load(
	page: SvelteTransformPage,
	cb: (body: BlockStatement, event_id: Identifier) => BlockStatement
) {
	// before we do anything, we need to find the load function
	let exported = find_exported_fn(page.script.body, 'load')
	let event_id = AST.identifier('event')
	let load_fn = exported?.declaration || null

	// lets get a reference to the body of the function
	let body: BlockStatement = AST.blockStatement([])
	if (load_fn?.type === 'ArrowFunctionExpression') {
		if (load_fn.body.type === 'BlockStatement') {
			body = load_fn.body
		} else {
			body = AST.blockStatement([AST.returnStatement(load_fn.body)])
			load_fn.body = body
		}
	} else if (load_fn && 'body' in load_fn) {
		body = load_fn.body
	}

	// if there is no load function, then we have to add one
	if (!load_fn) {
		load_fn = AST.functionDeclaration(
			AST.identifier('load'),
			[event_id],
			AST.blockStatement([])
		)
		load_fn.async = true
		page.script.body.splice(
			find_insert_index(page.script),
			0,
			AST.exportNamedDeclaration(load_fn)
		)
		body = load_fn.body
	}
	// the load function could be not an actual function but just an expression like an identifier or callexpression
	// in which case we need to replace the declared value to be a function that passes event on and adds what we want
	else if (load_fn.type === 'CallExpression' || load_fn.type === 'Identifier') {
		const exportStatement = exported?.export

		// this should never be true since we know load_fn exists but let's make typescript happy
		if (!exportStatement) {
			return
		}

		// add a global variable with the intermediate value
		const intermediateID = AST.identifier('houdini__intermediate__load__')
		page.script.body.push(
			AST.variableDeclaration('const', [AST.variableDeclarator(intermediateID, load_fn)])
		)

		// build up a function that does the right thing
		const newLoad = AST.arrowFunctionExpression(
			[AST.identifier('event')],
			AST.blockStatement([
				AST.variableDeclaration('const', [
					AST.variableDeclarator(
						AST.identifier('result'),
						AST.callExpression(intermediateID, [AST.identifier('event')])
					),
				]),
				AST.returnStatement(AST.identifier('result')),
			])
		)

		// and change the declared value to be an arrow function that invokes the required function
		// NOTE: we need the semi-colon here so we don't treat the above definition as a function
		;(
			(exportStatement.declaration as VariableDeclaration)!
				.declarations[0] as VariableDeclarator
		).init = newLoad

		load_fn = newLoad
		body = newLoad.body as BlockStatement
		// there is a load function, we need the event
	} else {
		// if there are no identifiers, we need to add one
		if (load_fn.params.length === 0) {
			load_fn.params.push(event_id)
		}
		// if the first parameter of the function declaration is an identifier, we're in business
		else if (load_fn.params[0]?.type === 'Identifier') {
			event_id = load_fn.params[0]
		}
		// the first parameter is not an identifier so it's almost certainly an object pattern pulling parameters out
		else if (load_fn.params[0].type === 'ObjectPattern') {
			// hold onto the pattern so we can re-use it as the first
			const pattern = load_fn.params[0]

			// overwrite the parameter as event
			load_fn.params[0] = event_id

			// redefine the variables as let in the first statement of the function
			body.body.unshift(
				AST.variableDeclaration('let', [AST.variableDeclarator(pattern, event_id)])
			)
		}
		// we can't work with this
		else {
			throw new Error(
				'Could not inject session data into load. Please open a ticket with the contents of ' +
					page.filepath
			)
		}
	}

	// modify the body
	load_fn.body = cb(body, event_id)
}
