import { ExpressionKind, StatementKind } from 'ast-types/gen/kinds'
import * as graphql from 'graphql'
import * as recast from 'recast'

import {
	Config,
	operation_requires_variables,
	ParsedFile,
	Script,
	walkGraphQLTags,
} from '../../common'
import { find_exported_fn, find_insert_index } from '../ast'
import { artifact_import, ensure_imports, store_import } from '../imports'
import { TransformPage } from '../plugin'

const AST = recast.types.builders

type ExportNamedDeclaration = recast.types.namedTypes.ExportNamedDeclaration
type VariableDeclaration = recast.types.namedTypes.VariableDeclaration
type Identifier = recast.types.namedTypes.Identifier

export default async function QueryProcessor(config: Config, page: TransformPage) {
	// only consider consider components in this processor
	if (!config.isComponent(page.filepath)) {
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

	// find all of the props of the component by looking for export let
	const props = (page.script.body.filter(
		(statement) =>
			statement.type === 'ExportNamedDeclaration' &&
			statement.declaration?.type === 'VariableDeclaration'
	) as ExportNamedDeclaration[]).flatMap(({ declaration }) =>
		(declaration as VariableDeclaration)!.declarations.map((dec) => {
			if (dec.type === 'VariableDeclarator') {
				return dec.id.type === 'Identifier' ? dec.id.name : ''
			}

			return dec.name
		})
	)

	// add an import for the context utility
	ensure_imports({
		config: page.config,
		script: page.script,
		import: ['getHoudiniContext'],
		sourceModule: '$houdini/runtime/lib/context',
	})

	// import the browser check
	ensure_imports({
		config: page.config,
		script: page.script,
		import: ['isBrowser'],
		sourceModule: '$houdini/runtime/adapter',
	})

	// define the store values at the top of the file
	for (const query of queries) {
		const factory = ensure_imports({
			import: [`${query.name}Store`],
			sourceModule: config.storeImportPath(query.name),
			config: page.config,
			script: page.script,
		}).ids[0]

		page.script.body.splice(
			find_insert_index(page.script),
			0,
			AST.variableDeclaration('const', [
				AST.variableDeclarator(store_id(query.name), AST.callExpression(factory, [])),
			])
		)
	}

	// define some things we'll need when fetching
	page.script.body.push(
		// houdini context
		AST.variableDeclaration('const', [
			AST.variableDeclarator(
				ctx_id,
				AST.callExpression(AST.identifier('getHoudiniContext'), [])
			),
		]),

		// a variable to hold the query input
		...queries.flatMap<StatementKind>((query) => {
			// the identifier to use for this variables inputs
			const input_name = local_input_id(query.name)

			// if the query does not have variables, just define something local
			const variable_fn = query_variable_fn(query.name)
			const has_variables = find_exported_fn(page.script.body, variable_fn)

			return [
				// define the inputs for the query
				AST.labeledStatement(
					AST.identifier('$'),
					//
					AST.expressionStatement(
						AST.assignmentExpression(
							'=',
							input_name,
							has_variables
								? AST.callExpression(AST.identifier('marshalInputs'), [
										AST.objectExpression([
											AST.objectProperty(
												AST.identifier('config'),
												AST.identifier('houdiniConfig')
											),
											AST.objectProperty(
												AST.identifier('artifact'),
												AST.memberExpression(
													store_id(query.name),
													AST.identifier('artifact')
												)
											),
											AST.objectProperty(
												AST.identifier('input'),
												AST.callExpression(
													AST.memberExpression(
														AST.identifier(variable_fn),
														AST.identifier('call')
													),
													[
														ctx_id,
														AST.objectExpression([
															AST.objectProperty(
																AST.identifier('props'),
																// pass every prop explicitly
																AST.objectExpression(
																	props.map((prop) =>
																		AST.objectProperty(
																			AST.identifier(prop),
																			AST.identifier(prop)
																		)
																	)
																)
															),
															// pull session, stuff, and url from the context
															...['session', 'url'].map((name) =>
																AST.objectProperty(
																	AST.identifier(name),
																	AST.callExpression(
																		AST.memberExpression(
																			ctx_id,
																			AST.identifier(name)
																		),
																		[]
																	)
																)
															),
														]),
													]
												)
											),
										]),
								  ])
								: AST.objectExpression([])
						)
					)
				),

				// load the query
				AST.labeledStatement(
					AST.identifier('$'),
					AST.expressionStatement(
						AST.logicalExpression(
							'&&',
							AST.identifier('isBrowser'),
							AST.callExpression(
								AST.memberExpression(store_id(query.name), AST.identifier('fetch')),
								[
									AST.objectExpression([
										AST.objectProperty(AST.identifier('context'), ctx_id),
										AST.objectProperty(
											AST.identifier('variables'),
											local_input_id(query.name)
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
	store_id: (name: string) => Identifier
): Promise<LoadTarget[]> {
	// if there's nothing to parse, we're done
	if (!parsed) {
		return []
	}

	// build up a list of the queries we run into
	const queries: {
		name: string
		variables: boolean
	}[] = []

	// look for inline queries
	await walkGraphQLTags(page.config, parsed, {
		where(tag) {
			return !!tag.definitions.find(
				(defn) => defn.kind === 'OperationDefinition' && defn.operation === 'query'
			)
		},
		dependency: page.addWatchFile,
		tag(tag) {
			// if the graphql tag was inside of a call expression, we need to assume that it's a
			// part of an inline document. if the operation is a query, we need to add it to the list
			// so that the load function can have the correct contents
			const { parsedDocument, parent } = tag
			const operation = page.config.extractDefinition(parsedDocument)
			if (parent.type === 'CallExpression' && operation.kind === 'OperationDefinition') {
				queries.push({
					name: operation.name!.value,
					// an operation requires variables if there is any non-null variable that doesn't have a default value
					variables: operation_requires_variables(operation),
				})

				tag.node.replaceWith(store_id(operation.name!.value))
			}
		},
	})

	return queries.map((query) => {
		return {
			store_id: AST.identifier(''),
			name: query.name,
			variables: query.variables,
		}
	})
}

export function query_variable_fn(name: string) {
	return `${name}Variables`
}

export type LoadTarget = {
	store_id: ExpressionKind
	name: string
	variables: boolean
}

const local_input_id = (name: string) => AST.identifier(`_${name}_Input`)
export const ctx_id = AST.identifier('_houdini_context_DO_NOT_USE')
