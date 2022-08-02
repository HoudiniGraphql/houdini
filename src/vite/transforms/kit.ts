// externals
import { namedTypes } from 'ast-types/gen/namedTypes'
import { StatementKind } from 'ast-types/gen/kinds'
import * as graphql from 'graphql'
import * as recast from 'recast'
import { Identifier } from 'estree'
// locals
import { walk_graphql_tags } from '../walk'
import { TransformContext } from '../plugin'
import { Config, parseSvelte, readFile, Script } from '../../common'
import { artifact_import, store_import } from '../imports'

const AST = recast.types.builders

type ExportNamedDeclaration = ReturnType<typeof recast.types.builders['exportNamedDeclaration']>

export default async function svelteKitProccessor(config: Config, ctx: TransformContext) {
	// if we aren't running on a kit project, don't do anything
	if (ctx.config.framework !== 'kit') {
		return
	}

	// if we are processing a route component (+page.svelte)
	if (ctx.config.isRoute(ctx.filepath)) {
		await process_route_component(ctx)
	}
	// if we are processing a route config file (+page.ts)
	else if (ctx.config.isRouteConfigFile(ctx.filepath)) {
		await process_route_config(ctx)
	}
}

async function process_route_component(ctx: TransformContext) {}

async function process_route_config(ctx: TransformContext) {
	// we need to collect all of the various queries associated with the query file
	const [page_query, inline_queries, page_stores] = await Promise.all([
		find_page_query(ctx),
		find_inline_queries(ctx),
		find_page_stores(ctx),
	])

	// add the load function to the query file
	add_load({
		ctx,
		external_queries: inline_queries.concat(page_query ?? []),
		page_stores,
	})
}

function add_load({
	ctx,
	external_queries,
	page_stores,
}: {
	ctx: TransformContext
	external_queries: LoadQuery[]
	page_stores: boolean
}) {
	// look for any hooks
	let before_load = find_exported_fn(ctx.program, 'beforeLoad')
	let after_load = find_exported_fn(ctx.program, 'afterLoad')

	// the name of the variable
	const request_context = AST.identifier('_houdini_context')

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
	ctx.program.content.body.push(AST.exportNamedDeclaration(preload_fn) as ExportNamedDeclaration)

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
			config: ctx.config,
			artifact: query,
			program: ctx.program,
		})
		const store_id = store_import({ config: ctx.config, artifact: query, program: ctx.program })

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
											AST.stringLiteral(ctx.config.framework)
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

	// add calls to user before/after load functions
	if (before_load || after_load) {
		let context = [request_context, ctx.config, external_queries] as const

		if (before_load) {
			preload_fn.body.body.splice(
				insert_index,
				0,
				...load_hook_statements('beforeLoad', ...context)
			)
		}

		if (after_load) {
			preload_fn.body.body.splice(-1, 0, ...load_hook_statements('afterLoad', ...context))
		}
	}
}

async function find_inline_queries(ctx: TransformContext): Promise<LoadQuery[]> {
	// build up a list of the queries we run into
	const queries: {
		name: string
		variables: boolean
	}[] = []

	// ideally we could just use ctx.load and look at the module's metadata
	// but vite doesn't support that: https://github.com/vitejs/vite/issues/6810

	// until that is fixed, we'll have to read the file directly and parse it separately
	// to find any inline queries

	// in order to know what we need to do here, we need to know if our
	// corresponding page component defined any inline queries
	const page_path = ctx.config.routePagePath(ctx.filepath)

	// read the page path and if it doesn't exist, there aren't any inline queries
	const contents = await readFile(page_path)
	if (!contents) {
		return []
	}

	const parsed = await parseSvelte(contents)

	// look for inline queries
	// @ts-ignore
	const deps = await walk_graphql_tags(config, parsed?.content, {
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
		ctx.addWatchFile(dep)
	}

	return queries.map((query) => {
		// we need to make sure that we have reference to the store
		// for every query
		const storeID = store_import({ config: ctx.config, artifact: query, program: ctx.program })

		return {
			store_identifier: AST.identifier(storeID),
			name: query.name,
			has_variables: query.variables,
		}
	})
}

async function find_page_query(ctx: TransformContext): Promise<LoadQuery | null> {
	// figure out the filepath for the page query
	const page_query_path = ctx.config.pageQueryPath(ctx.filepath)

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
		config: ctx.config,
		artifact: { name: definition.name!.value },
		program: ctx.program,
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
											afterLoadQueryInput(queries)
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

function afterLoadQueryInput(queries: LoadQuery[]) {
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

async function find_page_stores(ctx: TransformContext): Promise<boolean> {
	// let's check for existence by importing the file
	const mod = await import(ctx.filepath)
	const module = mod.default || mod

	// if there are no page stores we're done
	if (!module.houdini_load) {
		return false
	}

	// make sure that houdini_load is a list
	if (!Array.isArray(module.houdini_load)) {
		console.log('houdini_load must be a list')
		return false
	}

	// there is a load
	return true
}

function key_preload_payload(operation: { name: string }): string {
	return `_${operation.name}`
}

function key_variables(operation: { name: string }): string {
	return `_${operation.name}_Input`
}

function query_variable_fn(name: string) {
	return `${name}Variables`
}

function find_exported_fn(body: Script, name: string): ExportNamedDeclaration | null {
	return body.content.body.find(
		(expression) =>
			expression.type === 'ExportNamedDeclaration' &&
			expression.declaration?.type === 'FunctionDeclaration' &&
			expression.declaration?.id?.name === name
	) as ExportNamedDeclaration
}

type LoadQuery = { store_identifier: Identifier; name: string; has_variables: boolean }
