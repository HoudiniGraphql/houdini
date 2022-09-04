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
	const trigger = ensure_imports({
		page,
		sourceModule: '$houdini/runtime/adapter',
		import: ['setClientStarted'],
	}).ids[0]
	const on_mount = ensure_imports({
		page,
		sourceModule: 'svelte',
		import: ['onMount'],
	}).ids[0]

	// add the onMount at the end of the component
	page.script.body.push(
		AST.expressionStatement(
			AST.callExpression(on_mount, [
				AST.arrowFunctionExpression([], AST.callExpression(trigger, [])),
			])
		)
	)
}
