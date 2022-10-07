import { Config, find_graphql } from 'houdini'

import { store_import } from '../kit'
import { SvelteTransformPage } from './types'

export default async function GraphQLTagProcessor(config: Config, page: SvelteTransformPage) {
	// all graphql template tags need to be turned into a reference to the appropriate store
	await find_graphql(config, page.script, {
		dependency: page.watch_file,
		tag(tag) {
			// pull out what we need
			const { node, parsedDocument } = tag
			const operation = config.extractDefinition(parsedDocument)

			// we're going to turn the graphql tag into a reference to the document's
			// store
			node.replaceWith(store_import({ page, artifact: { name: operation.name!.value } }).id)
		},
	})
}
