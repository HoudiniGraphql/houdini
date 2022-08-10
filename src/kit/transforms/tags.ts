import * as graphql from 'graphql'
import * as recast from 'recast'

import { Config } from '../../common'
import { store_import } from '../imports'
import { TransformPage } from '../plugin'
import { walk_graphql_tags } from '../walk'

const AST = recast.types.builders

export default async function GraphQLTagProcessor(config: Config, ctx: TransformPage) {
	// all graphql template tags need to be turned into a reference to the appropriate store
	await walk_graphql_tags(config, ctx.script, {
		dependency: ctx.addWatchFile,
		tag(tag) {
			// pull out what we need
			const { node, parsedDocument } = tag
			const operation = parsedDocument.definitions[0] as graphql.ExecutableDefinitionNode

			// we're going to turn the graphql tag into a reference to the document's
			// store
			node.replaceWith(
				store_import({
					config,
					script: ctx.script,
					artifact: { name: operation.name!.value },
				}).id
			)
		},
	})
}
