import { recast } from 'houdini'
import { ensure_imports } from 'houdini/vite'

import { is_root_layout } from '../../kit'
import type { SvelteTransformPage } from '../types'

const AST = recast.types.builders

export default async function kit_init(page: SvelteTransformPage) {
	// we only care about the root layout file
	if (!is_root_layout(page.config, page.filepath)) {
		return
	}

	// we need to call setClientStarted onMount

	// make sure we have the right imports
	const set_client_started = ensure_imports({
		script: page.script,
		config: page.config,
		sourceModule: '$houdini/plugins/houdini-svelte/runtime/adapter',
		import: ['setClientStarted'],
	}).ids[0]
	const on_mount = ensure_imports({
		script: page.script,
		config: page.config,
		sourceModule: 'svelte',
		import: ['onMount'],
	}).ids[0]
	const [extract_session, set_session] = ensure_imports({
		script: page.script,
		config: page.config,
		sourceModule: '$houdini/plugins/houdini-svelte/runtime/session',
		import: ['extractSession', 'setClientSession'],
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
		script: page.script,
		config: page.config,
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
								AST.callExpression(extract_session, [
									AST.memberExpression(
										AST.identifier('val'),
										AST.identifier('data')
									),
								]),
							])
						),
					])
				),
			])
		)
	)
}
