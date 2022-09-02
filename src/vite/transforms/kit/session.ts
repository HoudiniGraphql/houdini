import path from 'path'
import * as recast from 'recast'

import { find_exported_fn, find_exported_id, find_insert_index } from '../../ast'
import { ensure_imports } from '../../imports'
import { TransformPage } from '../../plugin'

const AST = recast.types.builders

type ReturnStatement = recast.types.namedTypes.ReturnStatement

// we have 2 different places we need to consider to string the session along:
// - src/routes/+layout.server.js needs to pass the session onto the client at the root
// - src/routes/+layout.svelte needs to get the data from the layout and pass it to the client
export default function (page: TransformPage) {
	if (page.config.isRootLayout(page.filepath)) {
		rootLayout(page)
	} else if (page.config.isRootLayoutServer(page.filepath)) {
		rootLayoutServer(page)
	}
}

// the root layout (src/routes/+layout.svelte) needs to get the data from the server and pass
// it to the client side client. This happens in two steps:
// - define the data  prop if it doesn't exist
// - pass the data prop onto `client.receiveServerSession`
function rootLayout(page: TransformPage) {
	// if there is no data prop defined, we need to add one
	if (!find_exported_id(page.script, 'data')) {
		page.script.body.splice(
			find_insert_index(page.script),
			0,
			AST.exportNamedDeclaration(
				AST.variableDeclaration('let', [AST.variableDeclarator(AST.identifier('data'))])
			)
		)
	}

	// make sure we have a reference to the client
	const client_id = ensure_imports({
		page,
		import: '__houdini_client__',
		sourceModule: path.join(page.config.projectRoot, page.config.client),
	}).ids

	// invoke the client's method to set session
	page.script.body.push(
		AST.labeledStatement(
			AST.identifier('$'),
			AST.expressionStatement(
				AST.callExpression(
					AST.memberExpression(client_id, AST.identifier('receiveServerSession')),
					[AST.identifier('data')]
				)
			)
		)
	)
}

// the root layout server file (src/routes/+layout.server.js) needs to define a load that's accessible
// to all routes that adds the session set in the application's hook file along with any existing values
// This is done in three steps:
// - define a load if there isn't one
// - set the current return value to some internal name
// - add a new return statement that mixes in `...client.passServerSession(event)`
function rootLayoutServer(page: TransformPage) {
	// make sure we have a reference to the client
	const client_id = ensure_imports({
		page,
		import: '__houdini_client__',
		sourceModule: path.join(page.config.projectRoot, page.config.client),
	}).ids

	// before we do anything, we need to find the load function
	let load_fn = find_exported_fn(page.script.body, 'load')
	let event_id = AST.identifier('event')

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
	}
	// there is a load function, we need the event
	else {
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
			load_fn.body.body.unshift(
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

	// we have a load function and `event` is guaranteed to resolve correctly

	// now we need to find the return statement and replace it with a local variable
	// that we will use later
	let return_statement_index = load_fn.body.body.findIndex(
		(statement) => statement.type === 'ReturnStatement'
	)
	let return_statement: ReturnStatement
	if (return_statement_index !== -1) {
		return_statement = load_fn.body.body[return_statement_index] as ReturnStatement
	}
	// there was no return statement so its safe to just push one at the end that sets an empty
	// object
	else {
		return_statement = AST.returnStatement(AST.objectExpression([]))
		load_fn.body.body.push(return_statement)
		return_statement_index = load_fn.body.body.length - 1
	}

	// replace the return statement with the variable declaration
	const local_return_var = AST.identifier('__houdini__vite__plugin__return__value__')
	load_fn.body.body[return_statement_index] = AST.variableDeclaration('const', [
		AST.variableDeclarator(local_return_var, return_statement.argument),
	])

	// its safe to insert a return statement after the declaration that references event
	load_fn.body.body.splice(
		return_statement_index + 1,
		0,
		AST.returnStatement(
			AST.objectExpression([
				AST.spreadElement(
					AST.callExpression(
						AST.memberExpression(client_id, AST.identifier('passServerSession')),
						[event_id]
					)
				),
				AST.spreadElement(local_return_var),
			])
		)
	)
}
