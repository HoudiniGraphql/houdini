import { yellow } from '@kitql/helpers'
import type { IdentifierKind, StatementKind } from 'ast-types/lib/gen/kinds'
import type { namedTypes } from 'ast-types/lib/gen/namedTypes'
import * as graphql from 'graphql'
import { formatErrors, fs, TypeWrapper, unwrapType } from 'houdini'
import { artifact_import, ensure_imports, find_insert_index } from 'houdini/vite'
import * as recast from 'recast'

import { parseSvelte } from '../../extract'
import { extract_load_function, type HoudiniRouteScript } from '../../extractLoadFunction'
import {
	is_layout,
	is_route,
	is_route_script,
	layout_query_path,
	page_query_path,
	route_data_path,
	route_page_path,
} from '../../kit'
import {
	store_import_path
} from '../../storeConfig'
import { plugin_config } from '../../config'
import {
	houdini_afterLoad_fn,
	houdini_before_load_fn,
	houdini_on_error_fn,
	query_variable_fn,
} from '../../naming'
import type { RouteParam } from '../../routing'
import { route_params } from '../../routing'
import type { LoadTarget } from '../componentQuery'
import { find_inline_queries } from '../componentQuery'
import type { SvelteTransformPage } from '../types'

const AST = recast.types.builders

type ExportNamedDeclaration = ReturnType<(typeof recast.types.builders)['exportNamedDeclaration']>

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
			: artifact_import({
					config: page.config,
					script: page.script,
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
							(await fs.readFile(route_page_path(page.config, page.filepath))) || '',
							plugin_config(page.config).forceRunesMode
						)
				  )?.script ?? null,
			inline_query_store
		),
		find_page_info(page),
	])

	const houdini_load_queries: LoadTarget[] = []
	for (const [i, target] of (page_info.houdini_load ?? []).entries()) {
		houdini_load_queries.push(target)
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
		// if the query doesn't have any variables, there's nothing to do
		if (!query.variableDefinitions || query.variableDefinitions.length === 0) {
			continue
		}

		// add the internal variable function to the page and we'll call that when generating the load
		const variable_fn = query_variable_fn(query.name!.value)
		try {
			page.script.body.push(
				variable_function_for_query(page, query, page_info.exports.includes(variable_fn))
			)
		} catch (e) {
			formatErrors(e)
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
	let before_load = page_info.exports.includes(houdini_before_load_fn)
	let afterLoad = page_info.exports.includes(houdini_afterLoad_fn)
	let on_error = page_info.exports.includes(houdini_on_error_fn)

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
					AST.callExpression(AST.identifier('getCurrentConfig'), [])
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
			import: [`load_${query.name!.value}`],
			sourceModule: store_import_path({ config: page.config, name: query.name!.value }),
		})

		const load_fn = ids[0]

		const variables =
			(query.variableDefinitions?.length ?? 0) > 0
				? AST.awaitExpression(
						AST.callExpression(AST.identifier(__variable_fn_name(query.name!.value)), [
							AST.identifier('houdiniConfig'),
							AST.identifier('context'),
						])
				  )
				: AST.objectExpression([])

		preload_fn.body.body.splice(
			insert_index++,
			0,
			AST.expressionStatement(
				AST.assignmentExpression(
					'=',
					AST.memberExpression(input_obj, AST.literal(query.name!.value)),
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
								AST.memberExpression(input_obj, AST.literal(query.name!.value))
							),
							AST.objectProperty(AST.literal('event'), AST.identifier('context')),
							AST.objectProperty(
								AST.literal('blocking'),
								afterLoad || on_error
									? AST.booleanLiteral(true)
									: AST.identifier('undefined')
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
													AST.identifier(houdini_on_error_fn)
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
			preload_fn.body.body.splice(1, 0, load_hook_statements('before', ...args))
		}
	}

	if (afterLoad) {
		preload_fn.body.body.splice(
			preload_fn.body.body.length - 1,
			0,
			load_hook_statements('after', ...args)
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

	return definition
}

function load_hook_statements(
	name: 'before' | 'after',
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
						AST.objectProperty(AST.literal('variant'), AST.stringLiteral(name)),
						AST.objectProperty(
							AST.literal('hookFn'),
							AST.identifier(
								name === 'before' ? houdini_before_load_fn : houdini_afterLoad_fn
							)
						),
						// after load: pass query data to the hook
						...(name === 'after'
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

function variable_function_for_query(
	page: SvelteTransformPage,
	query: graphql.OperationDefinitionNode,
	has_local: boolean
): namedTypes.FunctionDeclaration {
	// there needs to be a local function if any of the required arguments for
	// the query do not have a non-optional value from the url

	// find the paramters we are passed to from the URL
	const params = route_params(page.filepath).params.reduce(
		(acc, param) => ({
			...acc,
			[param.name]: param,
		}),
		{} as Record<string, RouteParam>
	)

	// make sure that we have the utility to handle scalar args
	ensure_imports({
		config: page.config,
		script: page.script,
		import: ['parseScalar', 'marshalInputs'],
		sourceModule: '$houdini/runtime/lib/scalars',
	})

	// find any arguments that aren't optional but not given by the URL
	const missing_args = []
	const has_args: Record<string, string> = {}
	for (const definition of query.variableDefinitions ?? []) {
		const unwrapped = unwrapType(page.config, definition.type)

		// if the type is a runtime scalar, its optional
		const runtime_scalar =
			page.config.configFile.features?.runtimeScalars?.[unwrapped.type.name]

		// we need to remember the definition if
		// the argument to the operation is non-null
		// the url param doesn't exist or does exist but is optional
		if (
			unwrapped.wrappers[unwrapped.wrappers.length - 1] === TypeWrapper.NonNull &&
			!definition.defaultValue &&
			!runtime_scalar &&
			(!params[definition.variable.name.value] ||
				params[definition.variable.name.value].optional)
		) {
			missing_args.push(definition.variable.name)
		}

		// if the query variable is a route param, add it to the specific pile
		if (params[definition.variable.name.value]) {
			has_args[definition.variable.name.value] = unwrapped.type.name
		}
	}

	// if there are missing args but no local function then we have a problem
	if (missing_args.length > 0 && !has_local) {
		throw {
			filepath: page.filepath,
			message: `Could not find required variable function: ${yellow(
				query_variable_fn(query.name!.value)
			)}. maybe its not exported?`,
		}
	}

	// build up a function that mixes the appropriate url parameters with the
	// value of the variable function
	const fn_body: StatementKind[] = [
		// we'll collect everything in a local variable
		AST.variableDeclaration('const', [
			AST.variableDeclarator(
				AST.identifier('result'),
				AST.objectExpression(
					Object.entries(has_args).map(([arg, type]) => {
						return AST.objectProperty(
							AST.identifier(arg),
							AST.callExpression(AST.identifier('parseScalar'), [
								AST.identifier('config'),
								AST.stringLiteral(type),
								AST.memberExpression(
									AST.memberExpression(
										AST.identifier('event'),
										AST.identifier('params')
									),
									AST.identifier(arg)
								),
							])
						)
					})
				)
			),
		]),
	]

	// if there is a local function we need to call it and add the return value to
	// the running object
	if (has_local) {
		fn_body.push(
			AST.expressionStatement(
				AST.callExpression(
					AST.memberExpression(AST.identifier('Object'), AST.identifier('assign')),
					[
						AST.identifier('result'),
						AST.callExpression(AST.identifier('marshalInputs'), [
							AST.objectExpression([
								AST.objectProperty(
									AST.identifier('config'),
									AST.identifier('config')
								),
								AST.objectProperty(
									AST.identifier('input'),
									AST.awaitExpression(
										AST.callExpression(
											AST.identifier(query_variable_fn(query.name!.value)),
											[AST.identifier('event')]
										)
									)
								),
								AST.objectProperty(
									AST.identifier('artifact'),
									artifact_import({
										config: page.config,
										script: page.script,
										page,
										artifact: { name: query.name!.value },
									}).id
								),
							]),
						]),
					]
				)
			)
		)
	}

	// at the end of the function, return the result
	fn_body.push(AST.returnStatement(AST.identifier('result')))

	// build up the function declaration
	const declaration = AST.functionDeclaration(
		AST.identifier(__variable_fn_name(query.name!.value)),
		[AST.identifier('config'), AST.identifier('event')],
		AST.blockStatement(fn_body)
	)
	declaration.async = true

	// we're done
	return declaration
}

function __variable_fn_name(name: string) {
	return `__houdini__` + query_variable_fn(name)
}
