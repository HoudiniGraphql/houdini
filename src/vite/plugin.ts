// externals
import minimatch from 'minimatch'
import path from 'path'
import { Plugin } from 'vite'
import * as recast from 'recast'
import { Program, ExportNamedDeclaration } from 'estree'
import * as graphql from 'graphql'
import fs from 'fs/promises'
import { namedTypes } from 'ast-types/gen/namedTypes'
import { StatementKind } from 'ast-types/gen/kinds'
// locals
import { Config } from '../common'
import { walk_graphql_tags } from './walk'
import { artifact_import, store_import } from './imports'

const AST = recast.types.builders

export default function HoudiniPlugin(config: Config): Plugin {
	return {
		name: 'houdini',

		// add watch-and-run to their vite config
		async config(viteConfig, { command }) {
			return {
				server: {
					...viteConfig.server,
					fs: {
						...viteConfig.server?.fs,
						allow: ['.'].concat(viteConfig.server?.fs?.allow || []),
					},
				},
			}
		},

		// we need to process the source files
		async transform(code, filepath) {
			// if the file is not in our configured source path, we need to ignore it
			if (!minimatch(filepath, path.join(process.cwd(), config.sourceGlob))) {
				return
			}

			// build up the return value
			let ast = this.parse(code)
			const result: ReturnType<Required<Plugin>['transform']> = {
				meta: {},
				ast,
			}

			// turn any graphql tags into stores
			const dependencies = await transform_gql_tag(
				config,
				filepath,
				(result.ast! as unknown) as Program
			)

			// make sure we actually watch the dependencies
			for (const dep of dependencies) {
				this.addWatchFile(dep)
			}

			// if we are processing a route config file
			if (config.framework === 'kit' && config.isRouteConfigFile(filepath)) {
				// in order to know what we need to do here, we need to know if our
				// corresponding page component defined any inline queries
				const page_path = config.routePagePath(filepath)

				// ideally we could just use this.load and look at the module's metadata
				// but vite doesn't support that: https://github.com/vitejs/vite/issues/6810

				// until that is fixed, we'll have to read the file directly and parse it separately
				// to find any inline queries

				const route_queries: DiscoveredGraphQLTag[] = []
				try {
					const contents = await fs.readFile(page_path, 'utf-8')

					// look for inline queries
					const deps = await walk_graphql_tags(config, this.parse(contents), {
						where(tag) {
							return !!tag.definitions.find(
								(defn) =>
									defn.kind === 'OperationDefinition' &&
									defn.operation === 'query'
							)
						},
						tag(tag) {
							// if the graphql tag was inside of a call expression, we need to assume that it's a
							// part of an inline document. if the operation is a query, we need to add it to the list
							// so that the load function can have the correct contents
							const { parsedDocument, parent } = tag
							const operation = parsedDocument
								.definitions[0] as graphql.ExecutableDefinitionNode
							if (
								operation.kind === 'OperationDefinition' &&
								operation.operation === 'query' &&
								parent.type === 'CallExpression'
							) {
								route_queries.push({
									name: operation.name!.value,
									variables: Boolean(
										operation.variableDefinitions &&
											operation.variableDefinitions?.length > 0
									),
								})
							}
						},
					})

					// make sure we are watching all of the new deps
					for (const dep of deps) {
						this.addWatchFile(dep)
					}
				} catch {}

				// add a load function for every query found
				add_load(config, (result.ast! as unknown) as Program, route_queries)
			}

			return {
				...result,
				code: recast.print(result.ast!).code,
			}
		},
	}
}

type DiscoveredGraphQLTag = {
	name: string
	variables: boolean
}

async function transform_gql_tag(
	config: Config,
	filepath: string,
	code: Program
): Promise<string[]> {
	// look for
	return await walk_graphql_tags(config, code!, {
		tag(tag) {
			// pull out what we need
			const { node, parsedDocument, parent } = tag
			const operation = parsedDocument.definitions[0] as graphql.ExecutableDefinitionNode

			// we're going to turn the graphql tag into a reference to the document's
			// store
			node.replaceWith(
				AST.identifier(
					store_import({
						config: config,
						program: code,
						artifact: { name: operation.name!.value },
					})
				)
			)
		},
	})
}

function add_load(config: Config, program: Program, queries: DiscoveredGraphQLTag[]) {
	// the queries we have to fetch come from multiple places

	// look for any hooks
	let before_load = find_exported_fn(program, 'beforeLoad')
	let after_load = find_exported_fn(program, 'afterLoad')

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
							...queries.map((query) => {
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

	// export the function from the module
	program.body.push(AST.exportNamedDeclaration(preload_fn) as ExportNamedDeclaration)

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
	const needs_promise = queries.length > 1
	// a list of statements to await the query promises and check the results for errors
	const awaits_and_checks: StatementKind[] = []

	// every query that we found needs to be triggered in this function
	for (const query of queries) {
		let next_index = insert_index

		// figure out the local variable that holds the result
		const preload_key = key_preload_payload(query)

		// the identifier for the query variables
		const variable_id = key_variables(query)

		// make sure we've imported the artifact
		const artifact_id = artifact_import({ config: config, artifact: query, program })
		const store_id = store_import({ config: config, artifact: query, program })

		// add a local variable right before the return statement
		preload_fn.body.body.splice(
			next_index++,
			0,
			AST.variableDeclaration('const', [
				AST.variableDeclarator(
					AST.identifier(variable_id),
					query.variables
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
											AST.stringLiteral(config.framework)
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

		if (query.variables) {
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
		let context = [request_context, config, queries] as const

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

function load_hook_statements(
	name: 'beforeLoad' | 'afterLoad',
	request_context: namedTypes.Identifier,
	config: Config,
	queries: DiscoveredGraphQLTag[]
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

function afterLoadQueryInput(queries: DiscoveredGraphQLTag[]) {
	return AST.objectExpression(
		queries.map((query) =>
			AST.objectProperty(AST.literal(query.name), AST.identifier(key_variables(query)))
		)
	)
}

function after_load_data(queries: DiscoveredGraphQLTag[]) {
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

function key_preload_payload(operation: { name: string }): string {
	return `_${operation.name}`
}

function key_variables(operation: { name: string }): string {
	return `_${operation}_Input`
}

function query_variable_fn(name: string) {
	return `${name}Variables`
}

function find_exported_fn(body: Program, name: string): ExportNamedDeclaration | null {
	return body.body.find(
		(expression) =>
			expression.type === 'ExportNamedDeclaration' &&
			expression.declaration?.type === 'FunctionDeclaration' &&
			expression.declaration?.id?.name === name
	) as ExportNamedDeclaration
}
