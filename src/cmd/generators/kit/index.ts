import * as recast from 'recast'
import { transformWithEsbuild } from 'vite'

import { Config, ensureImports, parseJS } from '../../../common'
import * as fs from '../../../common/fs'
import { CollectedGraphQLDocument } from '../../types'

type Identifier = recast.types.namedTypes.Identifier

const AST = recast.types.builders

export default async function svelteKitGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	// if we're not in a sveltekit project, don't do anything
	if (config.framework !== 'kit') {
		return
	}

	// we need to walk down their route directory and create any variable definitions we need
	await config.walkRouteDir({
		async route({ dirpath, inlineQueries, routeQuery, routeScript }) {
			// in order to create the variable definition we need to know every query that is being
			// used in a specific route so we can generate versions of the variable functions with
			// the Params type from './$types' provided by the sveltekit rootDir

			// build up the names of queries that
			const queries = inlineQueries.concat(routeQuery ?? [])

			// routeScripts need to be imported so we can figure out if there is a houdini_load
			// and what's inside.
			const script = routeScript ? await fs.readFile(routeScript) : null
			if (routeScript && script) {
				// if we have a routeScript written in typescript, we need to compile it
				if (routeScript.endsWith('.ts')) {
					// transform the result
					let transformed = ''
					try {
						transformed = (await transformWithEsbuild(script, routeScript)).code
					} catch (e) {
						throw { message: (e as Error).message, filepath: routeScript }
					}

					// we'll import this file to ask questions about the houdini_load function
					routeScript = config.compiledAssetPath(routeScript)
					await fs.writeFile(routeScript, transformed)
				}

				// import the houdini_load function
				const loaded = (await config.importLoadFunction(routeScript)).houdini_load
				for (const query of loaded ?? []) {
					queries.push(query)
				}
			}

			// if we have no queries, there's nothing to do
			if (queries.length === 0) {
				return
			}

			// we need to create a typescript file that has a definition of the variable and hook functions
			const typedefs = AST.program([])

			ensureImports({
				body: typedefs.body,
				config,
				import: ['VariableFunction', 'AfterLoadFunction', 'BeforeLoadFunction'],
				sourceModule: '$houdini',
				importKind: 'type',
			})
			ensureImports({
				body: typedefs.body,
				config,
				import: ['Params'],
				sourceModule: './$types',
				importKind: 'type',
			})

			// we already compute the input types for every query so we just need
			// to get them from the typedef
			for (const query of queries) {
				const name = query.name!.value

				ensureImports({
					body: typedefs.body,
					config,
					import: [name + '$input', name],
					sourceModule: config.artifactImportPath(name),
					importKind: 'type',
				})[0]

				typedefs.body.push(
					...(await parseJS(
						`export type ${config.variableFunctionName(
							name
						)} = VariableFunction<Params, ${name}$input>
						`
					))!.script.body
				)
			}

			// add type definitions for the hooks

			// write the printed type definitions to the appropriate place
			const printed = recast.print(typedefs).code

			console.log(printed)
		},
	})
}
