import { ExpressionKind } from 'ast-types/gen/kinds'
import * as graphql from 'graphql'
import * as recast from 'recast'

import { Config, operation_requires_variables, ParsedFile, Script } from '../../common'
import { find_exported_fn } from '../ast'
import { artifact_import, ensure_imports, store_import } from '../imports'
import { TransformPage } from '../plugin'
import { walk_graphql_tags } from '../walk'

const AST = recast.types.builders

type ExportNamedDeclaration = recast.types.namedTypes.ExportNamedDeclaration
type VariableDeclaration = recast.types.namedTypes.VariableDeclaration

export default async function QueryProcessor(config: Config, page: TransformPage) {
	// only consider consider components in this processor
	if (!config.isComponent(page.filepath)) {
		return
	}

	// build up a list of the inline queries
	const queries = await find_inline_queries(page, page.script)
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
		...queries.map((query) => {
			// the identifier to use for this variables inputs
			const input_name = local_input_id(query.name)

			// if the query does not have variables, just define something local
			const variable_fn = query_variable_fn(query.name)
			if (!find_exported_fn(page.script.body, variable_fn)) {
				return AST.variableDeclaration('const', [
					AST.variableDeclarator(input_name, AST.objectExpression([])),
				])
			}

			// there is a variable function we need a reactive expression that computes it
			return AST.labeledStatement(
				AST.identifier('$'),
				//
				AST.expressionStatement(
					AST.assignmentExpression(
						'=',
						input_name,
						AST.callExpression(AST.identifier('marshalInputs'), [
							AST.objectExpression([
								AST.objectProperty(
									AST.identifier('config'),
									AST.identifier('houdiniConfig')
								),
								AST.objectProperty(
									AST.identifier('artifact'),
									AST.identifier(
										artifact_import({
											config: page.config,
											artifact: query,
											script: page.script,
										}).ids[0]
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
					)
				)
			)
		})
	)

	// add the necessary logic to the component source
	await process_component({
		page,
		queries,
		input_id: local_input_id,
	})
}

export async function process_component({
	page,
	queries,
	input_id,
}: {
	page: TransformPage
	queries: LoadTarget[]
	input_id: (name: string) => ExpressionKind
}) {
	// add an import for the context utility
	ensure_imports({
		config: page.config,
		script: page.script,
		import: ['getHoudiniContext'],
		sourceModule: '$houdini/runtime/lib/context',
	}).added

	// import the browser check
	ensure_imports({
		config: page.config,
		script: page.script,
		import: ['isBrowser'],
		sourceModule: '$houdini/runtime/adapter',
	}).added

	// make sure that we have imports for every store
	const store_ids: Record<string, string> = {}
	for (const query of queries) {
		const { id } = store_import({
			config: page.config,
			artifact: query,
			script: page.script,
		})
		store_ids[query.name] = id
	}

	// we need to add the client side fetches for every query that we ran into
	page.script.body.push(
		...queries.map((query) =>
			AST.labeledStatement(
				AST.identifier('$'),
				AST.expressionStatement(
					AST.logicalExpression(
						'&&',
						AST.identifier('isBrowser'),
						AST.callExpression(
							AST.memberExpression(
								AST.identifier(store_ids[query.name]),
								AST.identifier('fetch')
							),
							[
								AST.objectExpression([
									AST.objectProperty(AST.identifier('context'), ctx_id),
									AST.objectProperty(
										AST.identifier('variables'),
										input_id(query.name)
									),
								]),
							]
						)
					)
				)
			)
		)
	)
}

export async function find_inline_queries(
	page: TransformPage,
	parsed: Script | null
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
	await walk_graphql_tags(page.config, parsed, {
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
