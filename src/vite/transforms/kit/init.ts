import * as recast from 'recast'

import { ensure_imports } from '../../imports'
import { TransformPage } from '../../plugin'

const AST = recast.types.builders

export default async function kit_init(page: TransformPage) {
	// we only care about the root layout file
	if (!page.config.isRootLayout(page.filepath)) {
		return
	}

	// we need to call setClientStarted onMount

	// make sure we have the right imports
	const set_client_started = ensure_imports({
		page,
		sourceModule: '$houdini/runtime/adapter',
		import: ['setClientStarted'],
	}).ids[0]
	const on_mount = ensure_imports({
		page,
		sourceModule: 'svelte',
		import: ['onMount'],
	}).ids[0]
	const [set_session, session_key_name] = ensure_imports({
		page,
		sourceModule: '$houdini/runtime/lib/network',
		import: ['setSession', 'sessionKeyName'],
	}).ids

	// add the onMount at the end of the component
	page.script.body.push(
		AST.expressionStatement(
			AST.callExpression(on_mount, [
				AST.arrowFunctionExpression([], AST.callExpression(set_client_started, [])),
			])
		)
	)

	// we need to track updates in the page store as the client-side session
	const store_id = ensure_imports({
		page,
		sourceModule: '$app/stores',
		import: ['page'],
	}).ids[0]
	page.script.body.push(
		AST.expressionStatement(
			AST.callExpression(AST.memberExpression(store_id, AST.identifier('subscribe')), [
				AST.arrowFunctionExpression(
					[AST.identifier('val')],
					AST.blockStatement([
						AST.expressionStatement(
							AST.callExpression(set_session, [
								AST.memberExpression(
									AST.memberExpression(
										AST.identifier('val'),
										AST.identifier('data')
									),
									session_key_name,
									true
								),
							])
						),
					])
				),
			])
		)
	)
}
