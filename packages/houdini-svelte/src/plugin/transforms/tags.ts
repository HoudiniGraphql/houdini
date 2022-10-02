import { Config, find_graphql } from 'houdini'
import { TransformPage, store_import } from 'houdini/vite'
import * as recast from 'recast'

const AST = recast.types.builders

export default async function GraphQLTagProcessor(config: Config, page: TransformPage) {
	// all graphql template tags need to be turned into a reference to the appropriate store
	await find_graphql(config, page.script, {
		dependency: page.watch_file,
		tag(tag) {
			// pull out what we need
			const { node, parsedDocument } = tag
			const operation = config.extractDefinition(parsedDocument)

			// we're going to turn the graphql tag into a reference to the document's
			// store
			node.replaceWith(
				store_import({
					script,
					config: config,
					artifact: { name: operation.name!.value },
				}).id
			)
		},
	})
}
