import type { Config } from 'houdini'
import { find_graphql, recast } from 'houdini'

import { store_import } from '../kit'
import type { SvelteTransformPage } from './types'

const AST = recast.types.builders

export default async function GraphQLTagProcessor(config: Config, page: SvelteTransformPage) {
	// all graphql documents need to be turned into a reference to the appropriate store
	await find_graphql(config, page.script, {
		dependency: page.watch_file,
		tag(tag) {
			// pull out what we need
			const { node, parsedDocument } = tag
			const operation = config.extractDefinition(parsedDocument)

			const { id } = store_import({ page, artifact: { name: operation.name!.value } })

			// we're going to turn the graphql tag into a reference to the document's
			// store
			node.replaceWith(AST.newExpression(id, []))
		},
	})
}
