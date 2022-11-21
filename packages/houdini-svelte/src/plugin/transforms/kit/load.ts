import type { StatementKind, IdentifierKind } from 'ast-types/gen/kinds'
import type { namedTypes } from 'ast-types/gen/namedTypes'
import * as graphql from 'graphql'
import { formatErrors, operation_requires_variables, fs } from 'houdini'
import { find_insert_index, ensure_imports } from 'houdini/vite'
import * as recast from 'recast'

import { parseSvelte } from '../../extract'
import { extract_load_function } from '../../extractLoadFunction'
import {
	HoudiniRouteScript,
	is_layout,
	is_route,
	is_route_script,
	layout_query_path,
	page_query_path,
	route_data_path,
	route_page_path,
	store_import,
	store_import_path,
} from '../../kit'
import { LoadTarget, find_inline_queries, query_variable_fn } from '../query'
import { SvelteTransformPage } from '../types'

const AST = recast.types.builders

type ExportNamedDeclaration = ReturnType<typeof recast.types.builders['exportNamedDeclaration']>

export default async function kit_load_generator(page: SvelteTransformPage) {
	// if this isn't a route, move on
	const route = is_route(page.config, page.framework, page.filepath)
	const script = is_route_script(page.framework, page.filepath)
	if (!route && !script) {
		return
	}

	// the name to use for inline query documents
	const inline_query_store = (name: string) =>
		route
			? AST.memberExpression(AST.identifier('data'), AST.identifier(name))
			: store_import({
					page,
					artifact: { name },
			  }).id

	// we need to collect all of the various queries associated with the query file
	const [page_query, layout_query, inline_queries, page_info] = await Promise.all([
		find_special_query('Page', page),
		find_special_query('Layout', page),
		find_inline_queries(
			page,
			// if we are currently on the route file, there's nothing to parse
			route
				? page.script
				: (
						await parseSvelte(
							(await fs.readFile(route_page_path(page.config, page.filepath))) || ''
						)
				  )?.script ?? null,
			inline_query_store
		),
		find_page_info(page),
	])

	const houdini_load_queries = []
	for (const [i, target] of (page_info.houdini_load ?? []).entries()) {
		houdini_load_queries.push({
			name: target.name!.value,
			variables: operation_requires_variables(target),
			store_id: AST.memberExpression(AST.identifier('houdini_load'), AST.literal(i)),
		})
	}

	// add the load functions
	if (script) {
		const queries_that_needs_a_load = [...houdini_load_queries, ...inline_queries]
		// Add special queries files to the list only if we are in the good context
		const isLayout = is_layout(page.framework, page.filepath)
		if (isLayout && layout_query) {
			queries_that_needs_a_load.push(layout_query)
		}
		if (!isLayout && page_query) {
			queries_that_needs_a_load.push(page_query)
		}

		add_load({
			page,
			queries: queries_that_needs_a_load,
			page_info,
		})
	}

	if (route && inline_queries.length > 0) {
		// we need to check if there is a declared data prop
		const has_data = page.script.body.find(
			(statement) =>
				statement.type === 'ExportNamedDeclaration' &&
				statement.declaration?.type === 'VariableDeclaration' &&
				statement.declaration.declarations.length === 1 &&
				statement.declaration.declarations[0].type === 'VariableDeclarator' &&
				statement.declaration.declarations[0].id.type === 'Identifier' &&
				statement.declaration.declarations[0].id.name === 'data'
		)
		const has_unexported_data = page.script.body.find(
			(statement) =>
				statement.type === 'VariableDeclaration' &&
				statement.declarations.length === 1 &&
				statement.declarations[0].type === 'VariableDeclarator' &&
				statement.declarations[0].id.type === 'Identifier' &&
				statement.declarations[0].id.name === 'data'
		)
		if (has_unexported_data) {
			throw unexported_data_error(page.filepath)
		}

		// add the current context to any of the stores that we got from the load
		page.script.body.splice(
			find_insert_index(page.script),
			0,
			...((!has_data
				? [
						AST.exportNamedDeclaration(
							AST.variableDeclaration('let', [AST.identifier('data')])
						),
				  ]
				: []) as StatementKind[])
		)
	}
}

function add_load({
	page,
	queries,
	page_info,
}: {
	queries: LoadTarget[]
	page: SvelteTransformPage
	page_info: HoudiniRouteScript
}) {
	// if there is already a load function defined, don't do anything
	if (page_info.exports.includes('load') || queries.length === 0) {
		return
	}

	// let's verify that we have all of the variable functions we need before we mutate anything
	let invalid = false
	for (const query of queries) {
		const variable_fn = query_variable_fn(query.name)
		// if the page doesn't export a function with the correct name, something is wrong
		if (!page_info.exports.includes(variable_fn) && query.variables) {
			// tell them we're missing something
			formatErrors({
				filepath: page.filepath,
				message: `Could not find required variable function: ${variable_fn}. maybe its not exported? `,
			})

			// don't go any further
			invalid = true
		}
	}
	if (invalid) {
		return
	}

	// make sure we have RequestContext imported
	ensure_imports({
		script: page.script,
		config: page.config,
		import: ['RequestContext'],
		sourceModule: '$houdini/plugins/houdini-svelte/runtime/session',
	})
	ensure_imports({
		script: page.script,
		config: page.config,
		import: ['getCurrentConfig'],
		sourceModule: '$houdini/runtime/lib/config',
	})

	// look for any hooks
	let before_load = page_info.exports.includes('beforeLoad')
	let after_load = page_info.exports.includes('afterLoad')
	let on_error = page_info.exports.includes('onError')

	// some local variables
	const request_context = AST.identifier('houdini_context')
	const promise_list = AST.identifier('promises')
	const return_value = AST.memberExpression(request_context, AST.identifier('returnValue'))
	const result_obj = AST.identifier('result')
	const input_obj = AST.identifier('inputs')

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

			// get the current config
			AST.variableDeclaration('const', [
				AST.variableDeclarator(
					AST.identifier('houdiniConfig'),
					AST.awaitExpression(AST.callExpression(AST.identifier('getCurrentConfig'), []))
				),
			]),

			// and a list of all of the promises we generate
			AST.variableDeclaration('const', [
				AST.variableDeclarator(promise_list, AST.arrayExpression([])),
			]),

			// and an object we'll build up the compute inputs
			AST.variableDeclaration('const', [
				AST.variableDeclarator(input_obj, AST.objectExpression([])),
			]),

			// regardless of what happens between the context instantiation and return,
			// all we have to do is mix the return value with the props we want to send on
			AST.returnStatement(
				AST.objectExpression([
					AST.spreadElement(return_value),
					AST.spreadElement(result_obj),
				])
			),
		])
	)
	// mark the function as async
	preload_fn.async = true

	// export the function from the module
	page.script.body.push(AST.exportNamedDeclaration(preload_fn) as ExportNamedDeclaration)

	// we can start inserting statements in the generated load after the 2 statements we
	// added when defining the function
	let insert_index = 4

	// every query that we found needs to be triggered in this function
	for (const query of queries) {
		const { ids } = ensure_imports({
			script: page.script,
			config: page.config,
			import: [`load_${query.name}`],
			sourceModule: store_import_path({ config: page.config, name: query.name }),
		})

		const load_fn = ids[0]

		const variables = page_info.exports.includes(query_variable_fn(query.name))
			? AST.awaitExpression(
					AST.callExpression(
						AST.memberExpression(request_context, AST.identifier('computeInput')),
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
										store_import({
											page,
											artifact: query,
										}).id,
										AST.identifier('artifact')
									)
								),
							]),
						]
					)
			  )
			: AST.objectExpression([])

		preload_fn.body.body.splice(
			insert_index++,
			0,
			AST.expressionStatement(
				AST.assignmentExpression(
					'=',
					AST.memberExpression(input_obj, AST.literal(query.name)),
					variables
				)
			)
		)

		preload_fn.body.body.splice(
			insert_index++,
			0,
			// push the result of the fetch onto the list of promises
			AST.expressionStatement(
				AST.callExpression(AST.memberExpression(promise_list, AST.identifier('push')), [
					AST.callExpression(load_fn, [
						AST.objectExpression([
							AST.objectProperty(
								AST.literal('variables'),
								AST.memberExpression(input_obj, AST.literal(query.name))
							),
							AST.objectProperty(AST.literal('event'), AST.identifier('context')),
							AST.objectProperty(
								AST.literal('blocking'),
								AST.booleanLiteral(after_load || on_error)
							),
						]),
					]),
				])
			)
		)
	}

	// the only thing that's left is to merge the list of load promises into a single
	// object using something like Promise.all. We might need to do some custom wrapping
	// of the error.
	let args = [request_context, input_obj, result_obj] as const

	preload_fn.body.body.splice(
		insert_index++,
		0,
		AST.variableDeclaration('let', [
			AST.variableDeclarator(result_obj, AST.objectExpression([])),
		]),
		AST.tryStatement(
			AST.blockStatement([
				AST.expressionStatement(
					AST.assignmentExpression(
						'=',
						result_obj,
						AST.callExpression(
							AST.memberExpression(
								AST.identifier('Object'),
								AST.identifier('assign')
							),
							[
								AST.objectExpression([]),
								AST.spreadElement(
									AST.awaitExpression(
										AST.callExpression(
											AST.memberExpression(
												AST.identifier('Promise'),
												AST.identifier('all')
											),
											[promise_list]
										)
									)
								),
							]
						)
					)
				),
			]),
			AST.catchClause(
				AST.identifier('err'),
				null,
				AST.blockStatement([
					on_error
						? AST.expressionStatement(
								AST.awaitExpression(
									AST.callExpression(
										AST.memberExpression(
											request_context,
											AST.identifier('invokeLoadHook')
										),
										[
											AST.objectExpression([
												AST.objectProperty(
													AST.literal('variant'),
													AST.stringLiteral('error')
												),
												AST.objectProperty(
													AST.literal('hookFn'),
													AST.identifier('onError')
												),
												AST.objectProperty(
													AST.literal('error'),
													AST.identifier('err')
												),
												AST.objectProperty(AST.literal('input'), input_obj),
											]),
										]
									)
								)
						  )
						: AST.throwStatement(AST.identifier('err')),
				])
			)
		)
	)

	// add calls to user before/after load functions
	if (before_load) {
		if (before_load) {
			preload_fn.body.body.splice(1, 0, load_hook_statements('beforeLoad', ...args))
		}
	}

	if (after_load) {
		preload_fn.body.body.splice(
			preload_fn.body.body.length - 1,
			0,
			load_hook_statements('afterLoad', ...args)
		)
	}
}

async function find_special_query(
	type: `Page` | `Layout`,
	page: SvelteTransformPage
): Promise<LoadTarget | null> {
	// figure out the filepath for the page query
	const query_path =
		type === 'Page'
			? page_query_path(page.config, page.filepath)
			: layout_query_path(page.config, page.filepath)

	// if the file doesn't exist, we're done
	const contents = await fs.readFile(query_path)
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
		formatErrors({ message: 'gql file must contain a query.', filepath: query_path })
		return null
	}

	// generate an import for the store
	const { id } = store_import({
		page,
		artifact: { name: definition.name!.value },
	})

	return {
		store_id: id,
		name: definition.name!.value,
		variables: operation_requires_variables(definition),
	}
}

function load_hook_statements(
	name: 'beforeLoad' | 'afterLoad',
	request_context: namedTypes.Identifier,
	input_id: IdentifierKind,
	result_id: IdentifierKind
) {
	return AST.expressionStatement(
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
									AST.objectProperty(AST.literal('input'), input_id),
									AST.objectProperty(AST.literal('data'), result_id),
							  ]
							: []),
					]),
				]
			)
		)
	)
}

async function find_page_info(page: SvelteTransformPage): Promise<HoudiniRouteScript> {
	if (
		!is_route_script(page.framework, page.filepath) &&
		!is_route(page.config, page.framework, page.filepath)
	) {
		return { houdini_load: [], exports: [] }
	}

	// make sure we consider the typescript path first (so if it fails we resort to the .js one)
	let route_path = route_data_path(page.config, page.filepath)
	try {
		await fs.stat(route_path)
	} catch {
		route_path = route_path.replace('.js', '.ts')
	}

	return await extract_load_function(page.config, route_path)
}

function unexported_data_error(filepath: string) {
	return {
		filepath,
		message: `Encountered unexported local variable name data`,
		description: `This is not allowed in a route since it would conflict with Houdini's generated code`,
	}
}
