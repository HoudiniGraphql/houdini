import { IdentifierKind } from 'ast-types/gen/kinds'
import { namedTypes } from 'ast-types/gen/namedTypes'
import * as graphql from 'graphql'
import * as recast from 'recast'

import {
	Config,
	formatErrors,
	operation_requires_variables,
	parseSvelte,
	HoudiniRouteScript,
	readFile,
	stat,
} from '../../common'
import * as fs from '../../common/fs'
import { find_insert_index } from '../ast'
import { ensure_imports, store_import } from '../imports'
import { TransformPage } from '../plugin'
import { LoadTarget, find_inline_queries, query_variable_fn } from './query'

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

	// the name to use for inline query documents
	const inline_query_store = (name: string) =>
		is_route
			? AST.memberExpression(
					AST.memberExpression(AST.identifier('$$props'), AST.identifier('data')),
					AST.identifier(name)
			  )
			: store_import({
					config: page.config,
					script: page.script,
					artifact: { name },
			  }).id

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
				  )?.script ?? null,
			inline_query_store
		),
		find_page_info(page),
	])

	const queries = inline_queries.concat(page_query ?? [])
	for (const [i, target] of (page_info.houdini_load ?? []).entries()) {
		queries.push({
			name: target.name!.value,
			variables: operation_requires_variables(target),
			store_id: AST.memberExpression(AST.identifier('houdini_load'), AST.literal(i)),
		})
	}

	// if we are processing a route config file (+page.ts)
	if (is_route_script) {
		// add the load function to the query file
		add_load({
			page,
			queries,
			page_info,
		})
	}

	// we need this to happen last so it that the context always gets injected first
	if (is_route && queries.length > 0) {
		ensure_imports({
			config: page.config,
			script: page.script,
			import: ['injectContext'],
			sourceModule: '$houdini/runtime/lib/context',
		})

		// add the current context to any of the stores that we got from the load
		page.script.body.splice(
			find_insert_index(page.script),
			0,
			AST.labeledStatement(
				AST.identifier('$'),
				AST.expressionStatement(
					AST.callExpression(AST.identifier('injectContext'), [
						AST.arrayExpression(
							queries.map((query) =>
								AST.memberExpression(
									AST.memberExpression(
										AST.identifier('$$props'),
										AST.identifier('data')
									),
									AST.identifier(query.name)
								)
							)
						),
					])
				)
			)
		)
	}
}

function add_load({
	page,
	queries,
	page_info,
}: {
	queries: LoadTarget[]
	page: TransformPage
	page_info: HoudiniRouteScript
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
		config: page.config,
		script: page.script,
		import: ['RequestContext'],
		sourceModule: '$houdini/runtime/lib/network',
	})
	ensure_imports({
		config: page.config,
		script: page.script,
		import: ['getCurrentConfig'],
		sourceModule: '$houdini/runtime/lib/config',
	})

	// look for any hooks
	let before_load = page_info.exports.includes('beforeLoad')
	let after_load = page_info.exports.includes('afterLoad')

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

			// regardless of what happens between the contenxt instantiation and return,
			// all we have to do is mix the return value with the props we want to send one
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
			config: page.config,
			script: page.script,
			import: [`load_${query.name}`],
			sourceModule: page.config.storeImportPath(query.name),
		})

		const load_fn = ids[0]

		const variables = page_info.exports.includes(query_variable_fn(query.name))
			? AST.callExpression(
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
										config: page.config,
										script: page.script,
										artifact: query,
									}).id,
									AST.identifier('artifact')
								)
							),
						]),
					]
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
								AST.booleanLiteral(!!after_load)
							),
						]),
					]),
				])
			)
		)
	}

	preload_fn.body.body.splice(
		insert_index++,
		0,
		AST.variableDeclaration('const', [
			AST.variableDeclarator(
				result_obj,
				AST.callExpression(
					AST.memberExpression(AST.identifier('Object'), AST.identifier('assign')),
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
			),
		])
	)

	let args = [request_context, queries, input_obj, result_obj] as const

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
		formatErrors({ message: 'page.gql must contain a query.', filpath: page_query_path })
		return null
	}

	// generate an import for the store
	const { id } = store_import({
		config: page.config,
		artifact: { name: definition.name!.value },
		script: page.script,
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
	queries: LoadTarget[],
	input_id: IdentifierKind,
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
										AST.objectProperty(AST.literal('input'), input_id),
										AST.objectProperty(AST.literal('data'), result_id),
								  ]
								: []),
						]),
					]
				)
			)
		),
	]
}

async function find_page_info(page: TransformPage): Promise<HoudiniRouteScript> {
	if (!page.config.isRouteScript(page.filepath) && !page.config.isRoute(page.filepath)) {
		return { houdini_load: [], exports: [] }
	}

	// make sure we consider the typescript path first (so if it fails we resort to the .js one)
	let route_path = page.config.routeDataPath(page.filepath)
	try {
		await stat(route_path)
	} catch {
		route_path = route_path.replace('.js', '.ts')
	}

	return await page.config.extractLoadFunction(route_path)
}
