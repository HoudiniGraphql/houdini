import { transformWithEsbuild } from 'vite'

import { Config } from '../../../common'
import * as fs from '../../../common/fs'
import { CollectedGraphQLDocument } from '../../types'

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

			// we need to create a typescript file that has
			console.log(queries)
		},
	})
}
