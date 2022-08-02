import * as graphql from 'graphql'
import * as recast from 'recast'
import { Config } from '../../common'
import { store_import } from '../imports'
import { TransformContext } from '../plugin'
import { walk_graphql_tags } from '../walk'

const AST = recast.types.builders

export default async function transform_gql_tag(config: Config, ctx: TransformContext) {
	// @ts-ignore
	// all graphql template tags need to be turned into a reference to the appropriate store
	const deps = await walk_graphql_tags(config, ctx.program.content, {
		tag(tag) {
			// pull out what we need
			const { node, parsedDocument, parent } = tag
			const operation = parsedDocument.definitions[0] as graphql.ExecutableDefinitionNode

			// we're going to turn the graphql tag into a reference to the document's
			// store
			node.replaceWith(
				AST.identifier(
					store_import({
						config: config,
						program: ctx.program,
						artifact: { name: operation.name!.value },
					})
				)
			)
		},
	})

	for (const dep of deps) {
		ctx.addWatchFile(dep)
	}
}
