import { IdentifierKind } from 'ast-types/gen/kinds'
import { namedTypes } from 'ast-types/gen/namedTypes'
import * as graphql from 'graphql'
import * as recast from 'recast'

import {
	Config,
	operation_requires_variables,
	parseJS,
	parseSvelte,
	readFile,
	stat,
} from '../../common'
import { CompiledQueryKind, GraphQLTagResult } from '../../runtime'
import { find_insert_index } from '../ast'
import { ensure_imports, store_import } from '../imports'
import { TransformPage } from '../plugin'
import {
	LoadTarget,
	ctx_id,
	find_inline_queries,
	process_component,
	query_variable_fn,
} from './query'

const AST = recast.types.builders

type ExportNamedDeclaration = ReturnType<typeof recast.types.builders['exportNamedDeclaration']>

export default async function SvelteKitProcessor(config: Config, page: TransformPage) {
	// if we aren't running on a kit project, don't do anything
	if (page.config.framework !== 'kit') {
		return
	}

	// if this isn't a route, move on
	const is_route = page.config.isRoute(page.filepath)
	const is_route_script = page.config.isRouteScript(page.filepath)
	if (!is_route && !is_route_script) {
		return
	}

	// we need to collect all of the various queries associated with the query file
	const [page_query, inline_queries, page_info] = await Promise.all([
		find_page_query(page),
		find_inline_queries(
			page,
			// if we are currently on the route file, there's nothing to parse
			is_route
				? page.script
				: (
						await parseSvelte(
							(await readFile(page.config.routePagePath(page.filepath))) || ''
						)
				  )?.script ?? null
		),
		find_page_info(page),
	])

	const queries = inline_queries.concat(page_query ?? [])
	for (const [i, target] of (page_info.load ?? []).entries()) {
		queries.push({
			name: target.name,
			variables: target.variables,
			store_id: AST.memberExpression(AST.identifier('houdini_load'), AST.literal(i)),
		})
	}

	// if we are processing a route component (+page.svelte)
	if (is_route) {
		const input_obj = AST.identifier('inputs')

		page.script.body.push(
			AST.variableDeclaration('const', [
				AST.variableDeclarator(
					ctx_id,
					AST.callExpression(AST.identifier('getHoudiniContext'), [])
				),
			])
		)

		await process_component({
			page,
			queries,
			input_id: (name) => AST.memberExpression(input_obj, AST.literal(name)),
		})

		// now that we have the load, we need a reference to the loaded inputs added above
		page.script.body.splice(
			find_insert_index(page.script),
			0,
			AST.labeledStatement(
				AST.identifier('$'),
				AST.expressionStatement(
					AST.assignmentExpression(
						'=',
						input_obj,
						AST.memberExpression(
							AST.memberExpression(AST.identifier('$$props'), AST.identifier('data')),
							AST.identifier('inputs')
						)
					)
				)
			)
		)
	}
	// if we are processing a route config file (+page.ts)
	else if (is_route_script) {
		// add the load function to the query file
		add_load({
			page,
			queries,
			page_info,
		})
	}
}

function add_load({
	page,
	queries,
	page_info,
}: {
	queries: LoadTarget[]
	page: TransformPage
	page_info: PageScriptInfo
}) {
	// if there is already a load function defined, don't do anything
	if (page_info.exports.includes('load')) {
		return
	}

	// let's verify that we have all of the variable functions we need before we mutate anything
	let invalid = false
	for (const query of queries) {
		const variable_fn = query_variable_fn(query.name)
		// if the page doesn't export a function with the correct name, something is wrong
		if (!page_info.exports.includes(variable_fn) && query.variables) {
			// TODO: text
			// tell them we're missing something
			console.log()
			console.log(page_info.exports)
			console.log(`error in ${page.filepath}:
could not find required variable function: ${variable_fn}. maybe its not exported?`)

			// don't go any further
			invalid = true
		}
	}
	if (invalid) {
		return
	}

	// make sure we have RequestContext imported
	ensure_imports({
		config: page.config,
		script: page.script,
		import: ['RequestContext'],
		sourceModule: '$houdini/runtime/lib/network',
	})

	// look for any hooks
	let before_load = page_info.exports.includes('beforeLoad')
	let after_load = page_info.exports.includes('afterLoad')

	// some local variables
	const request_context = AST.identifier('houdini_context')
	const input_obj = AST.identifier('inputs')
	const promise_list = AST.identifier('promises')

	// build up a list of metadata for every store that we have to load

	const preload_fn = AST.functionDeclaration(
		AST.identifier('load'),
		[AST.identifier('context')],
		// return an object
		AST.blockStatement([
			// instantiate the context variable and then thread it through instead of passing `this` directly
			// then look to see if `this.error`, `this.redirect` were called before continuing onto the fetch
			AST.variableDeclaration('const', [
				AST.variableDeclarator(
					request_context,
					AST.newExpression(AST.identifier('RequestContext'), [AST.identifier('context')])
				),
			]),

			// the final return value from load is an object containing all of the inputs
			// for every query that we generated
			AST.variableDeclaration('const', [
				AST.variableDeclarator(input_obj, AST.objectExpression([])),
			]),

			// and a list of all of the promises we generate
			AST.variableDeclaration('const', [
				AST.variableDeclarator(promise_list, AST.arrayExpression([])),
			]),

			// regardless of what happens between the contenxt instantiation and return,
			// all we have to do is mix the return value with the props we want to send one
			AST.returnStatement(
				AST.objectExpression([
					AST.spreadElement(
						AST.memberExpression(request_context, AST.identifier('returnValue'))
					),
					AST.objectProperty(AST.identifier('inputs'), input_obj),
				])
			),
		])
	)
	// mark the function as async
	preload_fn.async = true

	// export the function from the module
	page.script.body.push(AST.exportNamedDeclaration(preload_fn) as ExportNamedDeclaration)

	// we can start inserting statements after we define the context
	let insert_index = 3

	// every query that we found needs to be triggered in this function
	for (const query of queries) {
		preload_fn.body.body.splice(
			insert_index++,
			0,
			AST.expressionStatement(
				AST.assignmentExpression(
					'=',
					AST.memberExpression(input_obj, AST.literal(query.name)),
					page_info.exports.includes(query_variable_fn(query.name))
						? AST.callExpression(
								AST.memberExpression(
									request_context,
									AST.identifier('computeInput')
								),
								[
									AST.objectExpression([
										AST.objectProperty(
											AST.literal('config'),
											AST.identifier('houdiniConfig')
										),
										AST.objectProperty(
											AST.literal('variableFunction'),
											AST.identifier(query_variable_fn(query.name))
										),
										AST.objectProperty(
											AST.literal('artifact'),
											AST.memberExpression(
												query.store_id,
												AST.literal('artifact')
											)
										),
									]),
								]
						  )
						: AST.objectExpression([])
				)
			),
			// push the result of the fetch onto the list of promises
			AST.expressionStatement(
				AST.callExpression(AST.memberExpression(promise_list, AST.identifier('push')), [
					AST.callExpression(
						AST.memberExpression(query.store_id, AST.identifier('fetch')),
						[
							AST.objectExpression([
								AST.objectProperty(
									AST.literal('variables'),
									AST.memberExpression(input_obj, AST.literal(query.name))
								),
								AST.objectProperty(AST.literal('event'), AST.identifier('context')),
								AST.objectProperty(
									AST.literal('blocking'),
									AST.booleanLiteral(!!after_load)
								),
							]),
						]
					),
				])
			)
		)

		// we added 2 elements
		insert_index++
	}

	// now that the promise list is done, let's wait for everything to finish
	const resolved_promises = AST.identifier('result')
	preload_fn.body.body.splice(
		insert_index++,
		0,
		AST.variableDeclaration('const', [
			AST.variableDeclarator(
				resolved_promises,
				AST.awaitExpression(
					AST.callExpression(
						AST.memberExpression(AST.identifier('Promise'), AST.identifier('all')),
						[promise_list]
					)
				)
			),
		])
	)

	let args = [request_context, page.config, queries, input_obj, resolved_promises] as const

	// add calls to user before/after load functions
	if (before_load) {
		if (before_load) {
			preload_fn.body.body.splice(1, 0, ...load_hook_statements('beforeLoad', ...args))
		}
	}

	if (after_load) {
		preload_fn.body.body.splice(
			preload_fn.body.body.length - 1,
			0,
			...load_hook_statements('afterLoad', ...args)
		)
	}
}

async function find_page_query(page: TransformPage): Promise<LoadTarget | null> {
	// figure out the filepath for the page query
	const page_query_path = page.config.pageQueryPath(page.filepath)

	// if the file doesn't exist, we're done
	const contents = await readFile(page_query_path)
	if (!contents) {
		return null
	}

	// we have a page query, make sure it contains a query
	const parsed = graphql.parse(contents)

	// find the query definition
	const definition = parsed.definitions.find(
		(defn) => defn.kind === 'OperationDefinition' && defn.operation === 'query'
	) as graphql.OperationDefinitionNode
	// if it doesn't exist, there is an error, but no discovered query either
	if (!definition) {
		// TODO: text
		console.log('page.gql must contain a query')
		return null
	}

	// generate an import for the store
	const { id } = store_import({
		config: page.config,
		artifact: { name: definition.name!.value },
		script: page.script,
	})

	return {
		store_id: AST.identifier(id),
		name: definition.name!.value,
		variables: operation_requires_variables(definition),
	}
}

function load_hook_statements(
	name: 'beforeLoad' | 'afterLoad',
	request_context: namedTypes.Identifier,
	config: Config,
	queries: LoadTarget[],
	input_obj: IdentifierKind,
	result_id: IdentifierKind
) {
	return [
		AST.expressionStatement(
			AST.awaitExpression(
				AST.callExpression(
					AST.memberExpression(request_context, AST.identifier('invokeLoadHook')),
					[
						AST.objectExpression([
							AST.objectProperty(
								AST.literal('variant'),
								AST.stringLiteral(name === 'afterLoad' ? 'after' : 'before')
							),
							AST.objectProperty(AST.literal('hookFn'), AST.identifier(name)),
							// after load: pass query data to the hook
							...(name === 'afterLoad'
								? [
										AST.objectProperty(AST.literal('input'), input_obj),
										AST.objectProperty(
											AST.literal('data'),
											AST.objectExpression(
												queries.map((query, i) =>
													AST.objectProperty(
														AST.stringLiteral(query.name),
														AST.memberExpression(
															result_id,
															AST.literal(i)
														)
													)
												)
											)
										),
								  ]
								: []),
						]),
					]
				)
			)
		),
	]
}

async function find_page_info(page: TransformPage): Promise<PageScriptInfo> {
	const nil: PageScriptInfo = { load: [], exports: [] }

	// if the page has mocked page stores return them
	if (process.env.NODE_ENV === 'test') {
		return page.mock_page_info ?? nil
	}

	if (!page.config.isRouteScript(page.filepath) && !page.config.isRoute(page.filepath)) {
		return nil
	}

	// make sure we consider the typescript path first (so if it fails we resort to the .js one)
	let route_path = page.config.routeDataPath(page.filepath)
	try {
		await stat(route_path)
	} catch {
		route_path = route_path.replace('.js', '.ts')
	}

	// let's check for existence by importing the file
	let module: {
		houdini_load?: (string | GraphQLTagResult) | (string | GraphQLTagResult)[]
		[key: string]: any
	}

	try {
		module = (await page.load(route_path)) as typeof module
	} catch (e) {
		if (!(e as Error).toString().includes('ERR_MODULE_NOT_FOUND')) {
			console.log(e)
		}

		return nil
	}

	// add the exports to the default return value
	nil.exports = Object.keys(module)

	// if there are no page stores we're done
	if (!module.houdini_load) {
		return nil
	}

	// if the load is not a list, embed it in one
	if (!Array.isArray(module.houdini_load)) {
		module.houdini_load = [module.houdini_load]
	}

	// build up a list of the referenced stores
	const load: QueryInfo[] = []

	const seen = new Set<string>()

	for (const document of module.houdini_load) {
		// if the document is a string then it's the result of a graphql template tag
		// we need to parse the string for data
		if (typeof document === 'string') {
			// parse the document
			let parsed: graphql.DocumentNode
			try {
				parsed = graphql.parse(document)
			} catch {
				// TODO: text
				console.log("we got a string that isn't a graphql query")
				continue
			}

			// look for a query definition
			const query = parsed.definitions.find(
				(defn): defn is graphql.OperationDefinitionNode =>
					defn.kind === 'OperationDefinition' && defn.operation === 'query'
			)
			if (!query) {
				// TODO: text
				console.log('houdini_load must contain store references')
				return nil
			}

			// dry up the name
			const name = query.name!.value

			// make sure a store only shows up once
			if (seen.has(name)) {
				// TODO: text
				console.log('a store can only appear once')
				return nil
			}
			seen.add(name)

			// add the store to the list
			load.push({
				name,
				variables: operation_requires_variables(query),
			})
		}
		// the document is not a string
		else {
			// validate the kind (so we know its a store)
			if (document.kind !== CompiledQueryKind) {
				console.log('you must pass query stores to houdini_load')
				continue
			}

			// add the store to the list
			load.push(document)
		}
	}

	// there is a load
	return {
		load,
		exports: nil.exports,
	}
}

export type PageScriptInfo = {
	load?: QueryInfo[]
	exports: string[]
}

type QueryInfo = {
	name: string
	variables: boolean
}
