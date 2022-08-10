import type { IdentifierKind } from 'ast-types/gen/kinds'
import * as recast from 'recast'

import { Config } from '../../common'
import { find_insert_index } from '../ast'
import { ensure_imports } from '../imports'
import { TransformPage } from '../plugin'

const AST = recast.types.builders

type ImportDeclaration = recast.types.namedTypes.ImportDeclaration
type Statement = recast.types.namedTypes.Statement

export default async function ContextProcessor(config: Config, page: TransformPage) {
	// only consider svelte files
	if (!page.filepath.endsWith('.svelte')) {
		return
	}

	// we need to collect the local identifiers of any store that we import
	const local_stores: IdentifierKind[] = page.script.body
		.filter((statement) => {
			return (
				statement.type === 'ImportDeclaration' &&
				statement.source.value?.toString().startsWith('$houdini')
			)
		})
		.flatMap((statement: Statement) => {
			const declaration = statement as ImportDeclaration
			const specifiers = declaration.specifiers ?? []

			const source = declaration.source.value
			if (typeof source !== 'string') {
				return []
			}

			return specifiers
				.filter((specifier) => {
					// if the specifier is for a default import, we need it if
					// the import is for a store path
					if (specifier.type === 'ImportDefaultSpecifier') {
						return source.startsWith(config.storeImportPath(''))
					}

					// if the specifier is for `$houdini` then we want any of the GQL specifiers
					if (specifier.type === 'ImportSpecifier') {
						return specifier.local?.name.startsWith('GQL_')
					}
				})
				.map((specifier) => specifier.local!)
		})

	// if there are no imports, there's nothing to do
	if (local_stores.length === 0) {
		return
	}

	// import the utility to inject the context
	const inject_fn = ensure_imports({
		config: page.config,
		script: page.script,
		sourceModule: '$houdini/runtime/lib/context',
		import: ['injectContext'],
	}).ids[0]

	page.script.body.splice(
		find_insert_index(page.script),
		0,
		AST.expressionStatement(
			AST.callExpression(inject_fn, [
				AST.arrayExpression(local_stores.map((store) => AST.identifier(store.name))),
			])
		)
	)
}
