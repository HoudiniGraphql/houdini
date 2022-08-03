// externals
import { namedTypes } from 'ast-types/gen/namedTypes'
import { StatementKind } from 'ast-types/gen/kinds'
import * as graphql from 'graphql'
import * as recast from 'recast'
import { Identifier } from 'estree'
// locals
import { walk_graphql_tags } from '../walk'
import { TransformPage } from '../plugin'
import { Config, parseSvelte, readFile, Script } from '../../common'
import { artifact_import, store_import } from '../imports'
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
	const [page_query, inline_queries] = await Promise.all([
		find_page_query(page),
		find_inline_queries(page),
		find_page_stores(page),
	])

	// add the load function to the query file
	add_load({
		page,
		external_queries: inline_queries.concat(page_query ?? []),
		page_stores: find_page_stores.length > 0,
	})
}

function add_load({
	page,
	external_queries,
	page_stores,
}: {
	page: TransformPage
	external_queries: LoadQuery[]
	page_stores: boolean
}) {
	// if there is already a load function defined, don't do anything
	if (find_exported_fn(page.script, 'load')) {
		return
	}

	// look for any hooks
	let before_load = find_exported_fn(page.script, 'beforeLoad')
	let after_load = find_exported_fn(page.script, 'afterLoad')

	// the name of the variable
	const request_context = AST.identifier('houdini_context')

	const preload_fn = AST.functionDeclaration(
		AST.identifier('load'),
		[AST.identifier('context')],
		// return an object
		AST.blockStatement([
			AST.returnStatement(
				AST.objectExpression([
					AST.spreadElement(
						AST.memberExpression(request_context, AST.identifier('returnValue'))
					),
					AST.objectProperty(
						AST.identifier('props'),
						AST.objectExpression([
							AST.spreadElement(
								AST.memberExpression(
									AST.memberExpression(
										request_context,
										AST.identifier('returnValue')
									),
									AST.identifier('props')
								)
							),
							...external_queries.map((query) => {
								const identifier = AST.identifier(key_variables(query))

								return AST.objectProperty(identifier, identifier)
							}),
						])
					),
				])
			),
		])
	)
	// mark the function as async
	preload_fn.async = true

	// @ts-ignore
	// export the function from the module
	page.script.body.push(AST.exportNamedDeclaration(preload_fn) as ExportNamedDeclaration)

	const return_value = AST.memberExpression(request_context, AST.identifier('returnValue'))

	// we can start inserting statements at the top of the function
	let insert_index = 0

	// instantiate the context variable and then thread it through instead of passing `this` directly
	// then look to see if `this.error`, `this.redirect` were called before continuing onto the fetch
	preload_fn.body.body.splice(
		insert_index,
		0,
		AST.variableDeclaration('const', [
			AST.variableDeclarator(
				request_context,
				AST.newExpression(AST.identifier('request_context'), [AST.identifier('context')])
			),
		])
	)

	// we just added one to the return index
	insert_index++

	// only split into promise and await if there are multiple queries
	const needs_promise = external_queries.length > 1
	// a list of statements to await the query promises and check the results for errors
	const awaits_and_checks: StatementKind[] = []

	// every query that we found needs to be triggered in this function
	for (const query of external_queries) {
		let next_index = insert_index

		// figure out the local variable that holds the result
		const preload_key = key_preload_payload(query)

		// the identifier for the query variables
		const variable_id = key_variables(query)

		// make sure we've imported the artifact
		const artifact_id = artifact_import({
			config: page.config,
			artifact: query,
			script: page.script,
		})
		const store_id = store_import({
			config: page.config,
			artifact: query,
			script: page.script,
		})

		// add a local variable right before the return statement
		preload_fn.body.body.splice(
			next_index++,
			0,
			AST.variableDeclaration('const', [
				AST.variableDeclarator(
					AST.identifier(variable_id),
					query.has_variables
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
											AST.literal('framework'),
											AST.stringLiteral(page.config.framework)
										),
										AST.objectProperty(
											AST.literal('variableFunction'),
											AST.identifier(query_variable_fn(query.name))
										),
										AST.objectProperty(
											AST.literal('artifact'),
											AST.identifier(artifact_id)
										),
									]),
								]
						  )
						: AST.objectExpression([])
				),
			])
		)

		if (query.has_variables) {
			preload_fn.body.body.splice(
				next_index++,
				0,
				// if we ran into a problem computing the variables
				AST.ifStatement(
					AST.unaryExpression(
						'!',
						AST.memberExpression(request_context, AST.identifier('continue'))
					),
					AST.blockStatement([AST.returnStatement(return_value)])
				)
			)
		}

		const fetch_call = AST.callExpression(
			AST.memberExpression(AST.identifier(store_id), AST.identifier('fetch')),
			[
				AST.objectExpression([
					AST.objectProperty(AST.literal('variables'), AST.identifier(variable_id)),
					AST.objectProperty(AST.literal('event'), AST.identifier('context')),
					AST.objectProperty(AST.literal('blocking'), AST.booleanLiteral(!!after_load)),
				]),
			]
		)

		if (needs_promise) {
			// local variable for holding the query promise
			const preload_promise_key = `${preload_key}Promise`

			preload_fn.body.body.splice(
				next_index++,
				0,
				// a variable holding the query promise
				AST.variableDeclaration('const', [
					AST.variableDeclarator(AST.identifier(preload_promise_key), fetch_call),
				])
			)

			awaits_and_checks.splice(
				0,
				0,
				// await the promise
				AST.variableDeclaration('const', [
					AST.variableDeclarator(
						AST.identifier(preload_key),
						AST.awaitExpression(AST.identifier(preload_promise_key))
					),
				])
			)
		} else {
			preload_fn.body.body.splice(
				next_index++,
				0,
				// perform the fetch and save the value under {preload_key}
				AST.variableDeclaration('const', [
					AST.variableDeclarator(
						AST.identifier(preload_key),
						AST.awaitExpression(fetch_call)
					),
				])
			)
		}
	}

	// add all awaits and checks
	preload_fn.body.body.splice(-1, 0, ...awaits_and_checks)

	let args = [request_context, page.config, external_queries] as const

	// add calls to user before/after load functions
	if (before_load) {
		if (before_load) {
			preload_fn.body.body.splice(
				insert_index,
				0,
				...load_hook_statements('beforeLoad', ...args)
			)
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
					variables: Boolean(
						operation.variableDefinitions && operation.variableDefinitions?.length > 0
					),
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
			store_identifier: AST.identifier(storeID),
			name: query.name,
			has_variables: query.variables,
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
		store_identifier: AST.identifier(store_id),
		name: definition.name!.value,
		has_variables: Boolean(
			definition.variableDefinitions && definition.variableDefinitions.length > 0
		),
	}
}

function load_hook_statements(
	name: 'beforeLoad' | 'afterLoad',
	request_context: namedTypes.Identifier,
	config: Config,
	queries: LoadQuery[]
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
							AST.objectProperty(
								AST.literal('framework'),
								AST.stringLiteral(config.framework)
							),
							AST.objectProperty(AST.literal('hookFn'), AST.identifier(name)),
							// after load: pass query data to the hook
							...(name === 'afterLoad'
								? [
										AST.objectProperty(
											AST.literal('input'),
											after_load_input(queries)
										),
										AST.objectProperty(
											AST.literal('data'),
											after_load_data(queries)
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

function after_load_input(queries: LoadQuery[]) {
	return AST.objectExpression(
		queries.map((query) =>
			AST.objectProperty(AST.literal(query.name), AST.identifier(key_variables(query)))
		)
	)
}

function after_load_data(queries: LoadQuery[]) {
	return AST.objectExpression(
		queries.map((query) =>
			AST.objectProperty(
				AST.literal(query.name),
				AST.memberExpression(
					AST.identifier(key_preload_payload(query)),
					AST.identifier('data')
				)
			)
		)
	)
}

async function find_page_stores(page: TransformPage): Promise<PageStoreReference[]> {
	// if the page has mocked page stores return them
	if (process.env.NODE_ENV === 'test') {
		return page.mock_page_stores ?? []
	}

	// let's check for existence by importing the file
	let mod: any
	try {
		mod = await import(page.filepath)
	} catch {
		return []
	}

	const module: { houdini_load?: GraphQLTagResult[]; [key: string]: any } = mod.default || mod

	// if there are no page stores we're done
	if (!module.houdini_load) {
		return []
	}

	// make sure that houdini_load is a list
	if (!Array.isArray(module.houdini_load)) {
		console.log('houdini_load must be a list')
		return []
	}

	// build up a list of the referenced stores
	const stores: PageStoreReference[] = []

	for (const store of module.houdini_load) {
		// if there is no kind in the value then its not a store reference
		if (!('kind' in store)) {
			console.log('you must pass stores to houdini_load')
			// don't load any stores
			return []
		}
		if (store.kind !== CompiledQueryKind) {
			console.log('you must pass query stores to houdini_load')
			// don't load any stores
			return []
		}

		// if the store requires variables but the function is not defined we can't continue
		const variable_fn = query_variable_fn(store.name)
		if (store.variables && !module[variable_fn]) {
			console.log('missing variable function. maybe its not exported?')
			return []
		}

		// add the store to the list
		stores.push({
			name: store.name,
			variables: !!module[variable_fn],
		})
	}

	// there is a load
	return stores
}

function key_preload_payload(operation: { name: string }): string {
	return `${operation.name}`
}

function key_variables(operation: { name: string }): string {
	return `${operation.name}_Input`
}

function query_variable_fn(name: string) {
	return `${name}Variables`
}

function find_exported_fn(script: Script, name: string): ExportNamedDeclaration | null {
	return script.body.find(
		(expression) =>
			expression.type === 'ExportNamedDeclaration' &&
			expression.declaration?.type === 'FunctionDeclaration' &&
			expression.declaration?.id?.name === name
	) as ExportNamedDeclaration
}

type LoadQuery = { store_identifier: Identifier; name: string; has_variables: boolean }

export type PageStoreReference = {
	name: string
	variables: boolean
}
