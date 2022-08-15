import path from 'path'
import * as recast from 'recast'
import { transformWithEsbuild } from 'vite'

import { Config } from '../../../common'
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
			const typeDefs = `import type { VariableFunction, AfterLoadFunction, BeforeLoadFunction }  from '$houdini'
import { Params } from './$types'

${queries
	.map((query) => {
		const name = query.name!.value

		return `import { ${name}$result, ${name}$input } from '${config.artifactImportPath(name)}'`
	})
	.join('\n')}

${queries
	.map((query) => {
		const name = query.name!.value

		return `export type ${config.variableFunctionName(
			name
		)} = VariableFunction<Params, ${name}$input>`
	})
	.join('\n')}

type AfterLoadData = {
	${queries
		.map((query) => {
			const name = query.name!.value

			return [name, name + '$result'].join(': ')
		})
		.join('\n')}
}

type AfterLoadInput = {
	${queries
		.map((query) => {
			const name = query.name!.value

			return [name, name + '$input'].join(': ')
		})
		.join('\n')}
}

export type AfterLoad = AfterLoadFunction<Params, AfterLoadData, AfterLoadInput>

export type BeforeLoad = BeforeLoadFunction<Params>
`
			// we need to write the type defs to the same route path relative to the type root
			// const targetPath = path.join(config.typeRouteDir,
			const relativePath = path.relative(config.routesDir, dirpath)
			const target = path.join(config.typeRouteDir, relativePath, config.typeRootFile)

			// make sure we have a home for the directory
			await fs.mkdirp(target)

			// write the file
			await fs.writeFile(target, typeDefs)
			console.log('writing', target)
		},
	})
}
