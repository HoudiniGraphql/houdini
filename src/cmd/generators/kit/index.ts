import path from 'path'

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
			if (routeScript) {
				// import the houdini_load function
				const { houdini_load } = await config.extractLoadFunction(routeScript)

				// add every load to the list
				queries.push(...(houdini_load ?? []))
			}

			// if we have no queries, there's nothing to do
			if (queries.length === 0) {
				return
			}

			// we need to write the type defs to the same route path relative to the type root
			// const targetPath = path.join(config.typeRouteDir,
			const relativePath = path.relative(config.routesDir, dirpath)
			const target = path.join(config.typeRouteDir, relativePath, config.typeRootFile)

			// we can't import from $houdini so we need to compute the relative path from the import
			const houdiniRelative = path.relative(target, config.typeRootDir)

			// we need to create a typescript file that has a definition of the variable and hook functions
			const typeDefs = `import type { VariableFunction, AfterLoadFunction, BeforeLoadFunction }  from '${houdiniRelative}/runtime/lib/types'
import { Params } from './$types'

${queries
	.map((query) => {
		const name = query.name!.value

		return `import { ${name}$result, ${name}$input } from '${houdiniRelative}/${config.artifactDirectoryName}/${name}'`
	})
	.join('\n')}

${queries
	.map((query) => {
		const name = query.name!.value
		// if the query does not have any variables, don't include anything
		if (!query.variableDefinitions?.length) {
			return ''
		}

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
			// if the query does not have any variables, don't include anything
			if (!query.variableDefinitions?.length) {
				return ''
			}

			const name = query.name!.value

			return [name, name + '$input'].join(': ')
		})
		.join('\n')}
}

export type AfterLoad = AfterLoadFunction<Params, AfterLoadData, AfterLoadInput>

export type BeforeLoad = BeforeLoadFunction<Params>
`

			// make sure we have a home for the directory
			await fs.mkdirp(path.dirname(target))

			// write the file
			await fs.writeFile(target, typeDefs)
		},
	})
}
