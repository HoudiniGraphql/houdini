import { Config, ensure_imports } from 'houdini'
import * as recast from 'recast'

import type { SvelteTransformPage } from '../types.js'
import { is_root_layout } from './paths.js'

const AST = recast.types.builders

export default async function kit_init(config: Config, page: SvelteTransformPage) {
	// we only care about the root layout file
	if (!is_root_layout(page.config, page.filepath)) {
		return
	}

	// we need to call setClientStarted onMount

	// make sure we have the right imports
	const set_client_started = ensure_imports({
		script: page.script,
		sourceModule: '$houdini/plugins/houdini-svelte/runtime/adapter',
		import: ['setClientStarted'],
	}).ids[0]
	const on_mount = ensure_imports({
		script: page.script,
		sourceModule: 'svelte',
		import: ['onMount'],
	}).ids[0]
	const [extract_session, set_session] = ensure_imports({
		script: page.script,
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

	// we need to track updates in page data as the client-side session
	const page_store = ensure_imports({
		script: page.script,
		sourceModule: '$app/state',
		import: ['page'],
	}).ids[0]

	// $effect dont get anyting in callback so we got to use store_page that is like page
	page.script.body.push(
		AST.expressionStatement(
			AST.callExpression(AST.identifier('$effect'), [
				AST.arrowFunctionExpression(
					[],
					AST.blockStatement([
						AST.expressionStatement(
							AST.callExpression(set_session, [
								AST.callExpression(extract_session, [
									AST.memberExpression(page_store, AST.identifier('data')),
								]),
							])
						),
					])
				),
			])
		)
	)
}
