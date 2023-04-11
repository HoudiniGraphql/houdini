import { logYellow } from '@kitql/helper'
import type { ExpressionKind } from 'ast-types/lib/gen/kinds'
import type * as graphql from 'graphql'
import type { Config, Script } from 'houdini'
import { find_graphql, formatErrors, recast } from 'houdini'
import type { TransformPage } from 'houdini/vite'
import { find_exported_fn, find_insert_index, ensure_imports } from 'houdini/vite'

import { is_component, store_import_path } from '../kit'
import { query_variable_fn } from '../naming'
import type { SvelteTransformPage } from './types'

const AST = recast.types.builders

type ExportNamedDeclaration = recast.types.namedTypes.ExportNamedDeclaration
type VariableDeclaration = recast.types.namedTypes.VariableDeclaration

export default async function QueryProcessor(config: Config, page: SvelteTransformPage) {
	// only consider consider components in this processor
	if (!is_component(config, page.framework, page.filepath)) {
		return
	}

	// we need to use the global stores for non routes
	const store_id = (name: string) => {
		return AST.identifier(`_houdini_` + name)
	}

	// build up a list of the inline queries
	const queries = await find_inline_queries(page, page.script, store_id)
	// if there aren't any, we're done
	if (queries.length === 0) {
		return
	}

	// find all of the props of the component by looking for export statements
	const props = (
		page.script.body.filter(
			(statement) =>
				statement.type === 'ExportNamedDeclaration' &&
				statement.declaration?.type === 'VariableDeclaration'
		) as ExportNamedDeclaration[]
	).flatMap(({ declaration }) =>
		(declaration as VariableDeclaration)!.declarations.map((dec) => {
			if (dec.type === 'VariableDeclarator') {
				return dec.id.type === 'Identifier' ? dec.id.name : ''
			}

			return dec.name
		})
	)

	ensure_imports({
		config: page.config,
		script: page.script,
		import: ['marshalInputs'],
		sourceModule: '$houdini/runtime/lib/scalars',
	})

	ensure_imports({
		config: page.config,
		script: page.script,
		import: ['getCurrentConfig'],
		sourceModule: '$houdini/runtime/lib/config',
	})

	ensure_imports({
		config: page.config,
		script: page.script,
		import: ['RequestContext'],
		sourceModule: '$houdini/plugins/houdini-svelte/runtime/session',
	})

	// import the browser check
	ensure_imports({
		config: page.config,
		script: page.script,
		import: ['isBrowser'],
		sourceModule: '$houdini/plugins/houdini-svelte/runtime/adapter',
	})

	// define the store values at the top of the file
	for (const query of queries) {
		const factory = ensure_imports({
			script: page.script,
			config: page.config,
			import: [`${query.name!.value}Store`],
			sourceModule: store_import_path({ config, name: query.name!.value }),
		}).ids[0]

		page.script.body.splice(
			find_insert_index(page.script),
			0,
			AST.variableDeclaration('const', [
				AST.variableDeclarator(store_id(query.name!.value), AST.newExpression(factory, [])),
			])
		)
	}

	// define some things we'll need when fetching
	page.script.body.push(
		// a variable to hold the query input
		...queries.flatMap((query) => {
			// if the query does not have variables, just define something local
			const variable_fn = query_variable_fn(query.name!.value)
			const has_variables = find_exported_fn(page.script.body, variable_fn)

			// If we need the variables function, but it's missing... let's display a message
			if (
				query.variableDefinitions &&
				query.variableDefinitions?.length > 0 &&
				has_variables === null
			) {
				formatErrors({
					filepath: page.filepath,
					message: `Could not find required variable function: ${logYellow(
						variable_fn
					)}. maybe its not exported? `,
				})
			}

			return [
				// define the inputs for the query
				AST.labeledStatement(
					AST.identifier('$'),

					AST.expressionStatement(
						AST.logicalExpression(
							'&&',
							AST.identifier('isBrowser'),
							AST.callExpression(
								AST.memberExpression(
									store_id(query.name!.value),
									AST.identifier('fetch')
								),
								[
									AST.objectExpression([
										AST.objectProperty(
											AST.identifier('variables'),
											//
											AST.callExpression(AST.identifier('marshalInputs'), [
												AST.objectExpression([
													AST.objectProperty(
														AST.identifier('config'),
														AST.callExpression(
															AST.identifier('getCurrentConfig'),
															[]
														)
													),
													AST.objectProperty(
														AST.identifier('artifact'),
														AST.memberExpression(
															store_id(query.name!.value),
															AST.identifier('artifact')
														)
													),
													AST.objectProperty(
														AST.identifier('input'),
														has_variables
															? AST.callExpression(
																	AST.memberExpression(
																		AST.identifier(variable_fn),
																		AST.identifier('call')
																	),
																	[
																		AST.newExpression(
																			AST.identifier(
																				'RequestContext'
																			),
																			[]
																		),
																		AST.objectExpression([
																			AST.objectProperty(
																				AST.identifier(
																					'props'
																				),
																				// pass every prop explicitly
																				AST.objectExpression(
																					props.map(
																						(prop) =>
																							AST.objectProperty(
																								AST.identifier(
																									prop as string
																								),
																								AST.identifier(
																									prop as string
																								)
																							)
																					)
																				)
																			),
																		]),
																	]
															  )
															: AST.objectExpression([])
													),
												]),
											])
										),
									]),
								]
							)
						)
					)
				),
			]
		})
	)
}

export async function find_inline_queries(
	page: TransformPage,
	parsed: Script | null,
	store_id: (name: string) => ExpressionKind
): Promise<LoadTarget[]> {
	// if there's nothing to parse, we're done
	if (!parsed) {
		return []
	}

	// build up a list of the queries we run into
	const queries: LoadTarget[] = []

	// look for inline queries
	await find_graphql(page.config, parsed, {
		where(tag) {
			// only consider query documents
			const definition = tag.definitions.find((defn) => defn.kind === 'OperationDefinition')
			if (!definition) {
				return false
			}
			const queryOperation = definition as graphql.OperationDefinitionNode
			if (queryOperation.operation !== 'query') {
				return false
			}

			// as long as they have the @load directive
			return !!queryOperation.directives?.find(
				(directive) => directive.name.value === page.config.loadDirective
			)
		},
		dependency: page.watch_file,
		tag(tag) {
			// if the graphql tag was inside of a call expression, we need to assume that it's a
			// part of an inline document. if the operation is a query, we need to add it to the list
			// so that the load function can have the correct contents
			const { parsedDocument } = tag
			const operation = page.config.extractQueryDefinition(parsedDocument)
			queries.push(operation)

			tag.node.replaceWith(store_id(operation.name!.value))
		},
	})

	return queries
}

export type LoadTarget = graphql.OperationDefinitionNode

const local_input_id = (name: string) => AST.identifier(`_${name}_Input`)
