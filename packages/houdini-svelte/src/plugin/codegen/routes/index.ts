import { OperationDefinitionNode } from 'graphql'
import { Config, fs, GenerateHookInput } from 'houdini'
import path from 'path'

import { extract_load_function } from '../../extractLoadFunction'
import {
	type_route_dir,
	walk_routes,
	stores_directory_name,
	store_suffix,
	Framework,
} from '../../kit'

export default async function svelteKitGenerator(
	framework: Framework,
	{ config }: GenerateHookInput
) {
	// this generator creates the locally imported type definitions.
	// the component type generator will handle
	if (framework !== 'kit') {
		return
	}

	console.log(config)

	async function walk_types(dirpath: string, visitor: any) {
		for (const child of await fs.readdir(dirpath)) {
			const childPath = path.join(dirpath, child)
			// if we run into another directory, keep walking down
			if ((await fs.stat(childPath)).isDirectory()) {
				await walk_types(childPath, visitor)
			}

			await visitor.route(childPath)
		}
	}

	//assumes that .sveltekit will be at project root. This is true unless
	const skt_path = path.normalize(config.projectRoot + '/.svelte-kit/types')
	const new_path = path.normalize(config.rootDir + '/types/testing/')
	await fs.copySync(skt_path, new_path)

	await walk_types(new_path, {
		async route(route_path: string) {
			//if not a type file return
			if (!route_path.endsWith('$types.d.ts')) {
				return
			}
			
			//get renamed path, this is the path that we will use for the rest of the loop
			const h_path = route_path.replace(/\$types.d.ts/, '$houdini.d.ts');
			
			// rename file 
			fs.rename(route_path, h_path);

			//match all values after src so we can access the project/src directory
			const root_path_reg = /src(.*)/;

			// get the project root dir so we can search it for files
			const src_path = path.dirname(h_path).match(root_path_reg)?.[0] ?? ''; 

			const path_in_project = path.join(config.projectRoot, src_path);



		},
	})

	// we need to walk down their route directory and create any variable definitions we need
	await walk_routes(config, framework, {
		async route({
			dirpath,
			pageScript,
			layoutScript,
			routePageQuery,
			routeLayoutQuery,
			inlineLayoutQueries,
			inlineQueries,
		}) {
			// in order to create the variable definition we need to know every query that is being
			// used in a specific route so we can generate versions of the variable functions with
			// the Params type from './$types' provided by the sveltekit rootDir

			let scriptPageExports: string[] = []
			let scriptLayoutExports: string[] = []

			const pageQueries = inlineQueries.concat(routePageQuery ?? [])
			const layoutQueries = inlineLayoutQueries.concat(routeLayoutQuery ?? [])

			// pageScript need to be imported so we can figure out if there is a houdini_load
			// and what's inside.
			if (pageScript) {
				// import the houdini_load function
				const { houdini_load, exports } = await extract_load_function(config, pageScript)

				// add every load to the list
				pageQueries.push(...(houdini_load ?? []))
				scriptPageExports = exports
			}

			// pageScript need to be imported so we can figure out if there is a houdini_load
			// and what's inside.
			if (layoutScript) {
				// import the houdini_load function
				const { houdini_load, exports } = await extract_load_function(config, layoutScript)

				// add every load to the list
				layoutQueries.push(...(houdini_load ?? []))
				scriptLayoutExports = exports
			}

			// if we have no queries, there's nothing to do
			if (pageQueries.length === 0 && layoutQueries.length === 0) {
				return
			}

			// we need to write the type defs to the same route path relative to the type root
			// const targetPath = path.join(config.typeRouteDir,
			const relativePath = path.relative(config.routesDir, dirpath)
			const target = path.join(type_route_dir(config), relativePath, config.typeRootFile)

			// we can't import from $houdini so we need to compute the relative path from the import
			const houdiniRelative = path
				.relative(target, config.typeRootDir)
				// Windows management
				.replaceAll('\\', '/')

			// the unique set of query names
			const queryNames: string[] = []
			const uniqueQueries: OperationDefinitionNode[] = []
			for (const query of pageQueries) {
				if (!queryNames.includes(query.name!.value)) {
					queryNames.push(query.name!.value)
					uniqueQueries.push(query)
				}
			}

			const layoutNames: string[] = []
			const uniqueLayoutQueries: OperationDefinitionNode[] = []
			for (const layout of layoutQueries) {
				if (!layoutNames.includes(layout.name!.value)) {
					layoutNames.push(layout.name!.value)
					uniqueLayoutQueries.push(layout)
				}
			}

			// we need to create a typescript file that has a definition of the variable and hook functions
			const typeDefs = getTypeDefs(
				houdiniRelative,
				config,
				uniqueQueries,
				pageQueries,
				uniqueLayoutQueries,
				layoutQueries,
				scriptPageExports,
				scriptLayoutExports
			)

			// make sure we have a home for the directory
			await fs.mkdirp(path.dirname(target))

			// write the file
			await fs.writeFile(target, typeDefs)
		},
	})
}

function getTypeDefs(
	houdiniRelative: string,
	config: Config,
	uniqueQueries: OperationDefinitionNode[],
	pageQueries: OperationDefinitionNode[],
	uniqueLayoutQueries: OperationDefinitionNode[],
	layoutQueries: OperationDefinitionNode[],
	scriptPageExports: string[],
	scriptLayoutExports: string[]
) {
	const afterPageLoad = scriptPageExports.includes('afterLoad')
	const beforePageLoad = scriptPageExports.includes('beforeLoad')
	const onPageError = scriptPageExports.includes('onError')

	const afterLayoutLoad = scriptLayoutExports.includes('afterLoad')
	const beforeLayoutLoad = scriptLayoutExports.includes('beforeLoad')
	const onLayoutError = scriptLayoutExports.includes('onError')

	return `import type * as Kit from '@sveltejs/kit';
import type { VariableFunction, AfterLoadFunction, BeforeLoadFunction }  from '${houdiniRelative}/plugins/houdini-svelte/runtime/types'
${
	pageQueries.length > 0
		? `import type { PageLoadEvent, PageData as KitPageData } from './$types'`
		: ``
}
${
	layoutQueries.length > 0
		? `import type { LayoutLoadEvent, LayoutData as KitPageData } from './$types'`
		: ``
}

${append_Store(houdiniRelative, config, uniqueQueries)}
${append_Store(houdiniRelative, config, uniqueLayoutQueries)}

${pageQueries.length > 0 ? `type PageParams = PageLoadEvent['params']` : ``}
${layoutQueries.length > 0 ? `type LayoutParams = LayoutLoadEvent['params']` : ``}

${append_VariablesFunction('Page', config, uniqueQueries)}
${append_VariablesFunction('Layout', config, uniqueLayoutQueries)}

${append_afterLoad('Page', afterPageLoad, pageQueries)}
${append_beforeLoad(beforePageLoad)}
${append_onError(onPageError)}
${append_afterLoad('Layout', afterLayoutLoad, layoutQueries)}
${append_beforeLoad(beforeLayoutLoad)}
${append_onError(onLayoutError)}

${append_TypeData(
	config,
	layoutQueries,
	'Layout',
	beforeLayoutLoad,
	afterLayoutLoad,
	onLayoutError
)}
${append_TypeData(config, pageQueries, 'Page', beforePageLoad, afterPageLoad, onPageError)}
`
}

function append_Store(houdiniRelative: string, config: Config, queries: OperationDefinitionNode[]) {
	return queries
		.map((query) => {
			const name = query.name!.value

			return `import { ${name}$result, ${name}$input } from '${houdiniRelative}/${
				config.artifactDirectoryName
			}/${name}'
	import { ${name}Store } from '${houdiniRelative}/${stores_directory_name()}/${name}'`
		})
		.join('\n')
}

function append_VariablesFunction(
	type: `Page` | `Layout`,
	config: Config,
	queries: OperationDefinitionNode[]
) {
	return queries
		.map((query) => {
			const name = query.name!.value
			// if the query does not have any variables, don't include anything
			if (!query.variableDefinitions?.length) {
				return ''
			}

			return `export type ${config.variableFunctionName(
				name
			)} = VariableFunction<${type}Params, ${name}$input>`
		})
		.join('\n')
}

function append_afterLoad(
	type: `Page` | `Layout`,
	afterLoad: boolean,
	queries: OperationDefinitionNode[]
) {
	return afterLoad
		? `
	type AfterLoadReturn = ReturnType<typeof import('./+${type.toLowerCase()}').afterLoad>;

	type AfterLoadData = {
		${internal_append_afterLoad(queries)}
	}

	type LoadInput = {
		${internal_append_afterLoadInput(queries)}
	}

	export type AfterLoadEvent = {
		event: PageLoadEvent
		data: AfterLoadData
		input: LoadInput
	}
	`
		: ''
}

function internal_append_afterLoad(queries: OperationDefinitionNode[]) {
	return `${queries
		.map((query) => {
			// if the query does not have any variables, don't include anything
			const name = query.name!.value

			return [name, name + '$result'].join(': ')
		})
		.join(', \n')}`
}

function internal_append_afterLoadInput(queries: OperationDefinitionNode[]) {
	return `${queries
		.filter((query) => query.variableDefinitions?.length)
		.map((query) => {
			// if the query does not have any variables, don't include anything
			const name = query.name!.value

			return [name, name + '$input'].join(': ')
		})
		.join(', \n')}`
}

function append_beforeLoad(beforeLoad: boolean) {
	return beforeLoad
		? `
export type BeforeLoadEvent = PageLoadEvent

type BeforeLoadReturn = ReturnType<typeof import('./+page').beforeLoad>;
`
		: ''
}

function append_onError(onError: boolean) {
	return onError
		? `
export type OnErrorEvent =  { event: LoadEvent, input: LoadInput, error: Error | Error[] }

type OnErrorReturn = ReturnType<typeof import('./+page').onError>;
`
		: ''
}

function append_TypeData(
	config: Config,
	queries: OperationDefinitionNode[],
	type: `Page` | `Layout`,
	beforeLoad: boolean,
	afterLoad: boolean,
	onError: boolean
) {
	if (queries.length === 0) {
		return ''
	}

	return `export type ${type}Data = {
		${queries
			.map((query) => {
				const name = query.name!.value

				return [name, name + store_suffix(config)].join(': ')
			})
			.join(', \n')}
} ${internal_append_TypeDataExtra(beforeLoad, afterLoad, onError)}`
}

function internal_append_TypeDataExtra(beforeLoad: boolean, afterLoad: boolean, onError: boolean) {
	return `${beforeLoad ? '& BeforeLoadReturn ' : ''} ${afterLoad ? '& AfterLoadReturn ' : ''}  ${
		onError ? '& OnErrorReturn ' : ''
	}`
}
