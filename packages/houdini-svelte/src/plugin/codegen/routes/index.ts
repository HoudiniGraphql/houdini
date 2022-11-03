import { OperationDefinitionNode, parse } from 'graphql'
import { Config, find_graphql, fs, GenerateHookInput } from 'houdini'
import path from 'path'

import { parseSvelte } from '../../extract'
import { extract_load_function } from '../../extractLoadFunction'
import {
	type_route_dir,
	stores_directory_name,
	store_suffix,
	Framework,
	is_layout_script,
	is_page_script,
	is_layout_component,
	is_component,
	plugin_config,
} from '../../kit'

//move this at some point
const routeQueryError = (filepath: string) => ({
	filepath,
	message: 'route query error',
})

export default async function svelteKitGenerator(
	framework: Framework,
	{ config }: GenerateHookInput
) {
	// this generator creates the locally imported type definitions.
	// the component type generator will handle
	if (framework !== 'kit') {
		return
	}

	async function walk_types(dirpath: string) {
		//since we are parsing on a directory level, whether a file is a component or a script doesn't really matter, we can just parse the file and push it to Layout or Page
		let pageExports: string[] = []
		let layoutExports: string[] = []
		let pageQueries: OperationDefinitionNode[] = []
		let layoutQueries: OperationDefinitionNode[] = []

		//parse all files and push contents into page/layoutExports, page/layoutQueries
		for (const child of await fs.readdir(dirpath)) {
			const childPath = path.join(dirpath, child)
			// if we run into another directory, keep walking down
			if ((await fs.stat(childPath)).isDirectory()) {
				await walk_types(childPath)
				continue //ensure that directories are not passed to route func
			}

			if (is_layout_script(framework, childPath)) {
				//maybe turn into switch case

				const { houdini_load, exports } = await extract_load_function(config, childPath)

				// add every load to the list
				layoutQueries.push(...(houdini_load ?? []))

				layoutExports.push(...exports)
			} else if (is_page_script(framework, childPath)) {
				const { houdini_load, exports } = await extract_load_function(config, childPath)

				// add every load to the list
				pageQueries.push(...(houdini_load ?? []))
				pageExports.push(...exports)
			} else if (is_layout_component(framework, childPath)) {
				const contents = await fs.readFile(childPath)
				if (!contents) {
					continue
				}
				const parsed = await parseSvelte(contents)
				if (!parsed) {
					continue
				}

				await find_graphql(config, parsed.script, {
					where: (tag) => {
						try {
							return !!config.extractQueryDefinition(tag)
						} catch {
							return false
						}
					},
					tag: async ({ parsedDocument }) => {
						let definition = config.extractQueryDefinition(parsedDocument)

						// might need this in future. unsure. used to apply transformations?
						// await visitor.inlineLayoutQueries?.(definition, childPath)
						layoutQueries.push(definition)
					},
				})
			} else if (is_component(config, framework, child)) {
				const contents = await fs.readFile(childPath)
				if (!contents) {
					continue
				}
				const parsed = await parseSvelte(contents)
				if (!parsed) {
					continue
				}

				// look for any graphql tags and push into queries.
				await find_graphql(config, parsed.script, {
					where: (tag) => {
						try {
							return !!config.extractQueryDefinition(tag)
						} catch {
							return false
						}
					},
					tag: async ({ parsedDocument }) => {
						let definition = config.extractQueryDefinition(parsedDocument)
						// might need this in future. unsure.
						// await visitor.inlineQueries?.(definition, childPath)
						pageQueries.push(definition)
					},
				})
			} else if (child === plugin_config(config).layoutQueryFilename) {
				const contents = await fs.readFile(childPath)
				if (!contents) {
					continue
				}
				//parse content
				try {
					layoutQueries.push(config.extractQueryDefinition(parse(contents)))
				} catch (e) {
					throw routeQueryError(childPath)
				}
			} else if (child === plugin_config(config).pageQueryFilename) {
				const contents = await fs.readFile(childPath)
				if (!contents) {
					continue
				}

				try {
					pageQueries.push(config.extractQueryDefinition(parse(contents)))
				} catch (e) {
					throw routeQueryError(childPath)
				}
			} else {
				continue
			}
		}

		if (
			pageQueries.length == 0 &&
			layoutQueries.length == 0 &&
			pageExports.length == 0 &&
			layoutExports.length == 0
		) {
			return
		} else {
			//remove testing later
			const relativePath = path.relative(config.routesDir, dirpath)
			const target = path.join(type_route_dir(config), relativePath, config.typeRootFile)

			const houdiniRelative = path
				.relative(target, config.typeRootDir)
				// Windows management
				.replaceAll('\\', '/')

			const relative_path_regex = /src(.*)/

			// here we define the location of the correspoding sveltekit type file
			const skTypeFile = path.join(
				config.projectRoot,
				'.svelte-kit/types',
				dirpath.match(relative_path_regex)?.[0] ?? '',
				'$types.d.ts'
			)
			
			// if corresponding type file exists, we can generate types. Otherwise we error
			if (fs.existsSync(skTypeFile)) {

				// get all unique queries for page and layout, used for defining imports and variable functions

				const queryNames: string[] = []
				const uniquePageQueries: OperationDefinitionNode[] = []
				for (const query of pageQueries) {
					if (!queryNames.includes(query.name!.value)) {
						queryNames.push(query.name!.value)
						uniquePageQueries.push(query)
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

				// read the svelte-kit $types.d.ts file into a string
				let skTypeString = fs.readFileSync(skTypeFile)

				//if the file is truthy (not empty)
				if (!!skTypeString) {

					//get the type imports for file

					const pageTypeImports = getTypeImports(
						houdiniRelative,
						config,
						uniquePageQueries
					)
					const layoutTypeImports = getTypeImports(
						houdiniRelative,
						config,
						uniqueLayoutQueries
					)

					// Util bools for ensuring no unnecessary types
					const afterPageLoad = pageExports.includes('afterLoad')
					const beforePageLoad = pageExports.includes('beforeLoad')
					const onPageError = pageExports.includes('onError')

					const afterLayoutLoad = layoutExports.includes('afterLoad')
					const beforeLayoutLoad = layoutExports.includes('beforeLoad')
					const onLayoutError = layoutExports.includes('onError')

					//check if either page or layout has variables exported.
					const pageVariableLoad = pageExports.some((x) => x.endsWith('Variables'))
					const layoutVariableLoad = layoutExports.some((x) => x.endsWith('Variables'))

					//default sktype string is defined as imports \n\n utility \n\n exports
					const splitString = skTypeString.split('\n\n')

					//name our sections
					let typeImports = splitString[0]
					let utilityTypes = splitString[1]
					let typeExports = splitString[2]

					// lots of comparisons but helpful to prevent unnecessary imports
					// define function imports e.g. import {VariableFunction, AferLoadFunction, BeforeLoadFunction} from 'relativePath'
					// will not include unnecessary imports.
					const functionImports = `${
						afterPageLoad ||
						beforePageLoad ||
						afterLayoutLoad ||
						beforeLayoutLoad ||
						pageVariableLoad ||
						layoutVariableLoad
							? `\nimport type { ${
									layoutVariableLoad || pageVariableLoad
										? 'VariableFunction, '
										: ''
							  }${afterLayoutLoad || afterPageLoad ? 'AfterLoadFunction, ' : ''}${
									beforeLayoutLoad || beforePageLoad ? 'BeforeLoadFunction ' : ''
							  }} from '${houdiniRelative}/plugins/houdini-svelte/runtime/types';`
							: ''
					}`

					// mutate typeImports with our functionImports, layout/pageStores, $result, $input, 
					typeImports = typeImports
						.concat(functionImports)
						.concat(layoutTypeImports)
						.concat(pageTypeImports)

					// if we need Page/LayoutParams, generate this type.

					// verify if necessary. might not be.
					const layoutParams = `${
						layoutQueries.length > 0 && !utilityTypes.includes('LayoutParams')
							? "\ntype LayoutParams = LayoutLoadEvent['params'];"
							: ''
					}`

					//page params are necessary though.
					const pageParams = `${
						pageQueries.length > 0 && !utilityTypes.includes('PageParams')
							? "\ntype PageParams = PageLoadEvent['params'];"
							: ''
					}`

					// mutate utilityTypes with our layoutParams, pageParams. 
					utilityTypes = utilityTypes
						.concat(layoutParams)
						.concat(pageParams)
						//replace all instances of $types.js with $houdini to ensure type inheritence.
						//any type imports will always be in the utilityTypes block
						.replaceAll(/\$types\.js/gm, '$houdini')

					// main bulk of the work done here.
					typeExports = typeExports
						//we define the loadInput, checks if any queries have imports
						.concat(append_loadInput(layoutQueries))
						.concat(append_loadInput(pageQueries))
						//define before and afterLoad types for page
						.concat(append_afterLoad('Page', afterPageLoad, pageQueries))
						.concat(append_beforeLoad(beforePageLoad))
						.concat(
							append_onError(
								onPageError,
								//if there are not inputs to any query, we won't define a LoadInput in our error type
								pageQueries.filter((x) => x.variableDefinitions?.length).length > 0
							)
						)
						//generate before and afterload for layout
						.concat(append_afterLoad('Layout', afterLayoutLoad, layoutQueries))
						.concat(append_beforeLoad(beforeLayoutLoad))
						.concat(
							append_onError(
								onLayoutError,
								//if there are not inputs to any query, we won't define a LoadInput in our error type
								pageQueries.filter((x) => x.variableDefinitions?.length).length > 0
							)
						)
						//do layout first because page should always take priority.
						.concat(append_VariablesFunction('Layout', config, uniqueLayoutQueries))
						.concat(append_VariablesFunction('Page', config, uniquePageQueries))
						//match all between 'LayoutData =' and ';' and combine additional types
						.replace(
							//regex to append our generated stores to the existing 
							//match all between 'LayoutData =' and ';' and combine additional types
							/(?<=LayoutData = )([\s\S]*?)(?=;)/,
							`Expand<$1 & { ${layoutQueries
								.map((query) => {
									const name = query.name!.value

									return [name, name + store_suffix(config)].join(': ')
								})
								.join('; ')} }${internal_append_TypeDataExtra(
								beforeLayoutLoad,
								afterLayoutLoad,
								onLayoutError
							)}>`
						)
						.replace(
							//regex to append our generated stores to the existing 
							//match all between 'PageData =' and ';' and combine additional types
							/(?<=PageData = )([\s\S]*?)(?=;)/,
							`Expand<$1 & { ${pageQueries
								.map((query) => {
									const name = query.name!.value

									return [name, name + store_suffix(config)].join(': ')
								})
								.join('; ')} }${internal_append_TypeDataExtra(
								beforePageLoad,
								afterPageLoad,
								onPageError
							)}>`
						)
						//convert to relative path (e.g. '../../../+page.js' => './+page') in order to preserve type when imported
						.replaceAll(/(?<=')([^']*?(\+layout|\+page)\.(js|ts))(?=')/g, './$2')

					//make dir of target if not exist
					await fs.mkdirp(path.dirname(target))
					// write the file
					await fs.writeFile(
						target,
						[typeImports, utilityTypes, typeExports].join('\n\n')
					)
				}
			} else {
				//we need svelte-kit types.
				throw Error(`SvelteKit types do not exist at route: ${skTypeFile}`)
			}
		}
	}

	//only operating on routes.
	await walk_types(path.join(config.projectRoot, 'src/routes'))
}

function getTypeImports(
	houdiniRelative: string,
	config: Config,
	queries: OperationDefinitionNode[]
) {
	return queries
		.map((query) => {
			const name = query.name!.value
			return `\nimport { ${name}$result, ${name}$input } from '${houdiniRelative}/${
				config.artifactDirectoryName
			}/${name}';\nimport { ${name}Store } from '${houdiniRelative}/plugins/houdini-svelte/${stores_directory_name()}/${name}';`
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

			return `\nexport type ${config.variableFunctionName(
				name
			)} = VariableFunction<${type}Params, ${name}$input>;`
		})
		.join('\n')
}

function append_loadInput(queries: OperationDefinitionNode[]) {
	return `${
		queries.filter((q) => q.variableDefinitions?.length).length
			? `\ntype LoadInput = { ${queries
					.filter((query) => query.variableDefinitions?.length)
					.map((query) => {
						// if the query does not have any variables, don't include anything
						const name = query.name!.value

						return [name, name + '$input'].join(': ')
					})
					.join('; ')} };`
			: ''
	}`
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
};

export type AfterLoadEvent = {
	event: PageLoadEvent
	data: AfterLoadData
	input: ${queries.filter((q) => q.variableDefinitions?.length).length ? 'LoadInput' : '{}'}
};
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
		.join(';\n\t')}`
}

function append_beforeLoad(beforeLoad: boolean) {
	return beforeLoad
		? `
export type BeforeLoadEvent = PageLoadEvent;
type BeforeLoadReturn = ReturnType<typeof import('./+page').beforeLoad>;
`
		: ''
}

function append_onError(onError: boolean, hasLoadInput: boolean) {
	return onError
		? `
type OnErrorReturn = ReturnType<typeof import('./+page').onError>;
export type OnErrorEvent =  { event: Kit.LoadEvent, input: ${
				hasLoadInput ? 'LoadInput' : '{}'
		  }, error: Error | Error[] };
`
		: ''
}

function internal_append_TypeDataExtra(beforeLoad: boolean, afterLoad: boolean, onError: boolean) {
	return `${beforeLoad ? ' & BeforeLoadReturn' : ''}${afterLoad ? ' & AfterLoadReturn' : ''}${
		onError ? ' & OnErrorReturn' : ''
	}`
}
