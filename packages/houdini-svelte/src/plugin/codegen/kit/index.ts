import { OperationDefinitionNode } from 'graphql'
import { CollectedGraphQLDocument, Config, fs } from 'houdini'
import path from 'path'

import { extract_load_function } from '../../extractLoadFunction'
import { type_route_dir, walk_routes, stores_directory_name, store_suffix } from '../../kit'

export default async function svelteKitGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	// if we're not in a sveltekit project, don't do anything
	if (config.framework !== 'kit') {
		return
	}

	// we need to walk down their route directory and create any variable definitions we need
	await walk_routes(config, {
		async route({ dirpath, inlineQueries, routeQuery, routeScript }) {
			// in order to create the variable definition we need to know every query that is being
			// used in a specific route so we can generate versions of the variable functions with
			// the Params type from './$types' provided by the sveltekit rootDir

			let scriptExports: string[] = []

			// build up the names of queries that
			const queries = inlineQueries.concat(routeQuery ?? [])

			// routeScripts need to be imported so we can figure out if there is a houdini_load
			// and what's inside.
			if (routeScript) {
				// import the houdini_load function
				const { houdini_load, exports } = await extract_load_function(config, routeScript)

				// add every load to the list
				queries.push(...(houdini_load ?? []))
				scriptExports = exports
			}

			// if we have no queries, there's nothing to do
			if (queries.length === 0) {
				return
			}

			// we need to write the type defs to the same route path relative to the type root
			// const targetPath = path.join(config.typeRouteDir,
			const relativePath = path.relative(config.routesDir, dirpath)
			const target = path.join(type_route_dir(config), relativePath, config.typeRootFile)

			// we can't import from $houdini so we need to compute the relative path from the import
			const houdiniRelative = path.relative(target, config.typeRootDir)

			// the unique set of query names
			const queryNames: string[] = []
			const uniqueQueries: OperationDefinitionNode[] = []
			for (const query of queries) {
				if (!queryNames.includes(query.name!.value)) {
					queryNames.push(query.name!.value)
					uniqueQueries.push(query)
				}
			}

			const afterLoad = scriptExports.includes('afterLoad')
			const beforeLoad = scriptExports.includes('beforeLoad')
			const onError = scriptExports.includes('onError')

			// we need to create a typescript file that has a definition of the variable and hook functions
			const typeDefs = `import type * as Kit from '@sveltejs/kit';
import type { VariableFunction, AfterLoadFunction, BeforeLoadFunction }  from '${houdiniRelative}/runtime/lib/types'
import type { PageLoadEvent, PageData as KitPageData } from './$types'

${uniqueQueries
	.map((query) => {
		const name = query.name!.value

		return `import { ${name}$result, ${name}$input } from '${houdiniRelative}/${
			config.artifactDirectoryName
		}/${name}'
import { ${name}Store } from '${houdiniRelative}/${stores_directory_name()}/${name}'`
	})
	.join('\n')}

type Params = PageLoadEvent['params']

${uniqueQueries
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
${
	afterLoad
		? `
type AfterLoadReturn = ReturnType<typeof import('./+page').afterLoad>;

type AfterLoadData = {
	${queries
		.map((query) => {
			// if the query does not have any variables, don't include anything

			const name = query.name!.value

			return [name, name + '$result'].join(': ')
		})
		.join(', \n')}
}

type LoadInput = {
	${queries
		.filter((query) => query.variableDefinitions?.length)
		.map((query) => {
			// if the query does not have any variables, don't include anything

			const name = query.name!.value

			return [name, name + '$input'].join(': ')
		})
		.join(', \n')}
}

export type AfterLoadEvent = {
	event: PageLoadEvent
	data: AfterLoadData
	input: LoadInput
}
`
		: ''
}

${
	beforeLoad
		? `

export type BeforeLoadEvent = PageLoadEvent

type BeforeLoadReturn = ReturnType<typeof import('./+page').beforeLoad>;
`
		: ''
}
${
	onError
		? `

export type OnErrorEvent =  { event: LoadEvent, input: LoadInput, error: Error | Error[] }

type OnErrorReturn = ReturnType<typeof import('./+page').onError>;
`
		: ''
}

export type PageData = {
	${queries
		.map((query) => {
			const name = query.name!.value

			return [name, name + store_suffix(config)].join(': ')
		})
		.join(', \n')}
} ${afterLoad ? '& AfterLoadReturn ' : ''} ${beforeLoad ? '& BeforeLoadReturn ' : ''} ${
				onError ? '& OnErrorReturn ' : ''
			}

`

			// make sure we have a home for the directory
			await fs.mkdirp(path.dirname(target))

			// write the file
			await fs.writeFile(target, typeDefs)
		},
	})
}
