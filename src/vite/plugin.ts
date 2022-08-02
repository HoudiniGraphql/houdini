// externals
import minimatch from 'minimatch'
import path from 'path'
import { Plugin } from 'vite'
import * as recast from 'recast'
import * as graphql from 'graphql'
// locals
import { Config } from '../common'
import { walk_graphql_tags } from './walk'
import { store_import } from './imports'
import { Program } from 'estree'
import generate from '../cmd/generate'
import { AcornNode, TransformResult } from 'rollup'
import svelteKitProccessor from './kit'

const AST = recast.types.builders

export default function HoudiniPlugin(config: Config): Plugin {
	return {
		name: 'houdini',

		// add watch-and-run to their vite config
		async config(viteConfig, { command }) {
			return {
				server: {
					...viteConfig.server,
					fs: {
						...viteConfig.server?.fs,
						allow: ['.'].concat(viteConfig.server?.fs?.allow || []),
					},
				},
			}
		},

		// when the build starts, we need to make sure to generate
		async buildStart() {
			await generate(config)
		},

		transform(code, filepath) {
			const ctx = {
				...this,
				config,
				filepath,
			}

			return transform(ctx, code)
		},
	}
}

export interface TransformContext {
	config: Config
	program: Program
	filepath: string
	parse: (val: string) => AcornNode
	addWatchFile: (path: string) => void
}

// we need to process the source files (pulled out to an external file for testing and the preprocessor)
export async function transform(
	ctx: Omit<TransformContext, 'program'>,
	code: string
): Promise<TransformResult> {
	// if the file is not in our configured source path, we need to ignore it
	if (!minimatch(ctx.filepath, path.join(process.cwd(), ctx.config.sourceGlob))) {
		return
	}

	// build up the return value
	let ast = ctx.parse(code)
	const result: ReturnType<Required<Plugin>['transform']> = {
		meta: {},
		ast,
	}
	const context: TransformContext = {
		...ctx,
		program: (result.ast! as unknown) as Program,
	}

	// turn any graphql tags into stores
	const dependencies = await transform_gql_tag(context)

	// make sure we actually watch the dependencies
	for (const dep of dependencies) {
		ctx.addWatchFile?.(dep)
	}

	// if we are processing a route config file
	if (ctx.config.framework === 'kit') {
		svelteKitProccessor(context)
	}

	return {
		...result,
		code: recast.print(result.ast!).code,
	}
}

async function transform_gql_tag(ctx: TransformContext): Promise<string[]> {
	// look for
	return await walk_graphql_tags(ctx.config, ctx.program, {
		tag(tag) {
			// pull out what we need
			const { node, parsedDocument, parent } = tag
			const operation = parsedDocument.definitions[0] as graphql.ExecutableDefinitionNode

			// we're going to turn the graphql tag into a reference to the document's
			// store
			node.replaceWith(
				AST.identifier(
					store_import({
						config: ctx.config,
						program: ctx.program,
						artifact: { name: operation.name!.value },
					})
				)
			)
		},
	})
}
