import { ExpressionKind, StatementKind } from 'ast-types/gen/kinds'
import * as graphql from 'graphql'
import * as recast from 'recast'

import { Config, operation_requires_variables, Script, walkGraphQLTags } from '../../../../common'
import { find_exported_fn, find_insert_index } from '../../../../vite/ast'
import { ensure_imports } from '../../../../vite/imports'
import { TransformPage } from '../../../../vite/plugin'

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
		page,
		import: ['marshalInputs'],
		sourceModule: '$houdini/runtime/lib/scalars',
	})

	ensure_imports({
		page,
		import: ['RequestContext'],
		sourceModule: '$houdini/runtime/lib/network',
	})

	// import the browser check
	ensure_imports({
		page,
		import: ['isBrowser'],
		sourceModule: '$houdini/runtime/adapter',
	})

	// define the store values at the top of the file
	for (const query of queries) {
		const factory = ensure_imports({
			page,
			import: [`${query.name}Store`],
			sourceModule: config.storeImportPath(query.name),
		}).ids[0]

		page.script.body.splice(
			find_insert_index(page.script),
			0,
			AST.variableDeclaration('const', [
				AST.variableDeclarator(store_id(query.name), AST.newExpression(factory, [])),
			])
		)
	}

	// define some things we'll need when fetching
	page.script.body.push(
		// a variable to hold the query input
		...queries.flatMap<StatementKind>((query) => {
			// if the query does not have variables, just define something local
			const variable_fn = query_variable_fn(query.name)
			const has_variables = find_exported_fn(page.script.body, variable_fn)

			return [
				// define the inputs for the query
				AST.labeledStatement(
					AST.identifier('$'),
					//
					AST.expressionStatement(
						AST.callExpression(
							AST.memberExpression(
								AST.callExpression(AST.identifier('marshalInputs'), [
									AST.objectExpression([
										AST.objectProperty(
											AST.identifier('artifact'),
											AST.memberExpression(
												store_id(query.name),
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
																AST.identifier('RequestContext'),
																[]
															),
															AST.objectExpression([
																AST.objectProperty(
																	AST.identifier('props'),
																	// pass every prop explicitly
																	AST.objectExpression(
																		props.map((prop) =>
																			AST.objectProperty(
																				AST.identifier(
																					prop
																				),
																				AST.identifier(prop)
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
								]),
								AST.identifier('then')
							),
							[
								AST.arrowFunctionExpression(
									[local_input_id(query.name)],
									// load the query
									AST.logicalExpression(
										'&&',
										AST.identifier('isBrowser'),
										AST.callExpression(
											AST.memberExpression(
												store_id(query.name),
												AST.identifier('fetch')
											),
											[
												AST.objectExpression([
													AST.objectProperty(
														AST.identifier('variables'),
														local_input_id(query.name)
													),
												]),
											]
										)
									)
								),
							]
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
	const queries: {
		name: string
		variables: boolean
	}[] = []

	// look for inline queries
	await walkGraphQLTags(page.config, parsed, {
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

			// as long as they don't have the @houdini directive with load set to false
			return !queryOperation.directives?.find(
				(directive) =>
					directive.name.value === page.config.houdiniDirective &&
					directive.arguments?.find(
						(arg) =>
							arg.name.value === 'load' &&
							arg.value.kind === 'BooleanValue' &&
							!arg.value.value
					)
			)
		},
		dependency: page.watch_file,
		tag(tag) {
			// if the graphql tag was inside of a call expression, we need to assume that it's a
			// part of an inline document. if the operation is a query, we need to add it to the list
			// so that the load function can have the correct contents
			const { parsedDocument, parent } = tag
			const operation = page.config.extractQueryDefinition(parsedDocument)
			queries.push({
				name: operation.name!.value,
				// an operation requires variables if there is any non-null variable that doesn't have a default value
				variables: operation_requires_variables(operation),
			})

			tag.node.replaceWith(store_id(operation.name!.value))
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
