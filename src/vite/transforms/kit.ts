// externals
import { namedTypes } from 'ast-types/gen/namedTypes'
import { IdentifierKind, ExpressionKind } from 'ast-types/gen/kinds'
import * as graphql from 'graphql'
import * as recast from 'recast'
// locals
import { walk_graphql_tags } from '../walk'
import { TransformPage } from '../plugin'
import { Config, operation_requires_variables, parseSvelte, readFile, Script } from '../../common'
import { artifact_import, ensure_imports, store_import } from '../imports'
import { CompiledQueryKind, GraphQLTagResult } from '../../runtime'

const AST = recast.types.builders

type ExportNamedDeclaration = ReturnType<typeof recast.types.builders['exportNamedDeclaration']>

export default async function svelteKitProcessor(config: Config, page: TransformPage) {
	// if we aren't running on a kit project, don't do anything
	if (page.config.framework !== 'kit') {
		return
	}

	// if we are processing a route component (+page.svelte)
	if (page.config.isRoute(page.filepath)) {
		await process_component(page)
	}
	// if we are processing a route config file (+page.ts)
	else if (page.config.isRouteScript(page.filepath)) {
		await process_script(page)
	}
}

async function process_component(page: TransformPage) {}

async function process_script(page: TransformPage) {
	// we need to collect all of the various queries associated with the query file
	const [page_query, inline_queries, page_info] = await Promise.all([
		find_page_query(page),
		find_inline_queries(page),
		find_page_info(page),
	])

	// add the load function to the query file
	add_load({
		page,
		queries: inline_queries.concat(page_query ?? []),
		page_info,
	})
}

function add_load({
	page,
	queries: external_queries,
	page_info,
}: {
	page: TransformPage
	queries: LoadQuery[]
	page_info: PageScriptInfo
}) {
	// if there is already a load function defined, don't do anything
	if (page_info.exports.includes('load')) {
		return
	}

	// let's verify that we have all of the variable functions we need before we mutate anything
	let invalid = false
	for (const query of (page_info.load ?? []).concat(external_queries)) {
		const variable_fn = query_variable_fn(query.name)
		// if the page doesn't export a function with the correct name, something is wrong
		if (!page_info.exports.includes(variable_fn) && query.variables) {
			// tell them we're missing something
			console.log(`error in ${page.filepath}:
could not find required variable function: ${variable_fn}. maybe its not exported?
`)

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
	const load = external_queries
	for (const [i, target] of (page_info.load ?? []).entries()) {
		load.push({
			name: target.name,
			variables: target.variables,
			store_id: AST.memberExpression(AST.identifier('houdini_load'), AST.literal(i)),
		})
	}

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
	// @ts-ignore
	page.script.body.push(AST.exportNamedDeclaration(preload_fn) as ExportNamedDeclaration)

	// we can start inserting statements after we define the context
	let insert_index = 3

	// every query that we found needs to be triggered in this function
	for (const query of load) {
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

	let args = [request_context, page.config, load, input_obj, resolved_promises] as const

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

async function find_inline_queries(page: TransformPage): Promise<LoadQuery[]> {
	// build up a list of the queries we run into
	const queries: {
		name: string
		variables: boolean
	}[] = []

	// ideally we could just use page.load and look at the module's metadata
	// but vite doesn't support that: https://github.com/vitejs/vite/issues/6810

	// until that is fixed, we'll have to read the file directly and parse it separately
	// to find any inline queries

	// in order to know what we need to do here, we need to know if our
	// corresponding page component defined any inline queries
	const page_path = page.config.routePagePath(page.filepath)

	// read the page path and if it doesn't exist, there aren't any inline queries
	const contents = await readFile(page_path)
	if (!contents) {
		return []
	}

	const parsed = await parseSvelte(contents)

	// look for inline queries
	const deps = await walk_graphql_tags(page.config, parsed, {
		where(tag) {
			return !!tag.definitions.find(
				(defn) => defn.kind === 'OperationDefinition' && defn.operation === 'query'
			)
		},
		tag(tag) {
			// if the graphql tag was inside of a call expression, we need to assume that it's a
			// part of an inline document. if the operation is a query, we need to add it to the list
			// so that the load function can have the correct contents
			const { parsedDocument, parent } = tag
			const operation = parsedDocument.definitions[0] as graphql.ExecutableDefinitionNode
			if (
				operation.kind === 'OperationDefinition' &&
				operation.operation === 'query' &&
				parent.type === 'CallExpression'
			) {
				queries.push({
					name: operation.name!.value,
					// an operation requires variables if there is any non-null variable that doesn't have a default value
					variables: operation_requires_variables(operation),
				})
			}
		},
	})

	// make sure we are watching all of the new deps
	for (const dep of deps) {
		page.addWatchFile(dep)
	}

	return queries.map((query) => {
		// we need to make sure that we have reference to the store
		// for every query
		const storeID = store_import({
			config: page.config,
			artifact: query,
			script: page.script,
		})

		return {
			store_id: AST.identifier(storeID),
			name: query.name,
			variables: query.variables,
		}
	})
}

async function find_page_query(page: TransformPage): Promise<LoadQuery | null> {
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
		console.log('page.gql must contain a query')
		return null
	}

	// generate an import for the store
	const store_id = store_import({
		config: page.config,
		artifact: { name: definition.name!.value },
		script: page.script,
	})

	return {
		store_id: AST.identifier(store_id),
		name: definition.name!.value,
		variables: operation_requires_variables(definition),
	}
}

function load_hook_statements(
	name: 'beforeLoad' | 'afterLoad',
	request_context: namedTypes.Identifier,
	config: Config,
	queries: LoadQuery[],
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

	// let's check for existence by importing the file
	let module: { houdini_load?: GraphQLTagResult[]; [key: string]: any }
	try {
		module = await import(page.filepath)
	} catch {
		return nil
	}

	// if there are no page stores we're done
	if (!module.houdini_load) {
		return nil
	}

	// make sure that houdini_load is a list
	if (!Array.isArray(module.houdini_load)) {
		console.log('houdini_load must be a list')
		return nil
	}

	// build up a list of the referenced stores
	const stores: PageStoreReference[] = []

	const seen: string[] = []

	for (const store of module.houdini_load) {
		// make sure a store only shows up once
		if (seen.includes(store.name)) {
			console.log('a store can only appear once')
			return nil
		}
		seen.push(store.name)

		// if there is no kind in the value then its not a store reference
		if (!('kind' in store)) {
			console.log('you must pass stores to houdini_load')
			// don't load any stores
			return nil
		}
		if (store.kind !== CompiledQueryKind) {
			console.log('you must pass query stores to houdini_load')
			// don't load any stores
			return nil
		}

		// add the store to the list
		stores.push({
			name: store.name,
			variables: store.variables,
		})
	}

	// there is a load
	return {
		load: stores,
		exports: Object.keys(module),
	}
}

function query_variable_fn(name: string) {
	return `${name}Variables`
}

type LoadQuery = {
	store_id: ExpressionKind
	name: string
	variables: boolean
}

export type PageScriptInfo = {
	load?: PageStoreReference[]
	exports: string[]
}

type PageStoreReference = {
	name: string
	variables: boolean
}
