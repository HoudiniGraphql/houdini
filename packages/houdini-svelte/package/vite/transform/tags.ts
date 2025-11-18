import type { Config } from 'houdini'
import { find_graphql, extractDefinition, ensure_imports } from 'houdini'
import * as recast from 'recast'

import type { SvelteTransformPage } from '../types.js'

type Identifier = recast.types.namedTypes.Identifier
const AST = recast.types.builders

export default async function GraphQLTagProcessor(config: Config, page: SvelteTransformPage) {
	let replaced = false
	// all graphql documents need to be turned into a reference to the appropriate store
	await find_graphql(config, page.script, {
		dependency: page.watch_file,
		tag(tag) {
			// pull out what we need
			const { node, parsedDocument } = tag
			const operation = extractDefinition(parsedDocument)

			const { id } = store_import({ page, artifact: { name: operation.name!.value } })

			// we're going to turn the graphql tag into a reference to the document's
			// store
			node.replaceWith(AST.newExpression(id, []))
			replaced = true
		},
	})

	// if (replaced) {
	//   console.log(page.filepath + '\n' + recast.print(page.script).code)
	// }
}

function store_import({
	page,
	artifact,
}: {
	page: SvelteTransformPage
	artifact: { name: string }
}): { id: Identifier; added: number } {
	const { ids, added } = ensure_imports({
		script: page.script,
		sourceModule: `$houdini/plugins/houdini-svelte/stores/${artifact.name}`,
		import: [`${artifact.name}Store`],
	})

	return { id: ids[0], added }
}
