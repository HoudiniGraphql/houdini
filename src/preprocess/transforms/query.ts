// externals
import * as recast from 'recast'
import * as graphql from 'graphql'
import { ExportNamedDeclaration, ReturnStatement, Statement } from '@babel/types'
import { namedTypes } from 'ast-types/gen/namedTypes'
import { ObjectExpressionKind } from 'ast-types/gen/kinds'
import { StatementKind } from 'ast-types/gen/kinds'
import path from 'path'
// locals
import { Config, Script } from '../../common'
import { TransformDocument } from '../types'
import {
	walkTaggedDocuments,
	EmbeddedGraphqlDocument,
	storeImport,
	artifactIdentifier,
	ensureImports,
	storeIdentifier,
} from '../utils'
const AST = recast.types.builders

// in order for query values to update when mutations fire (after the component has mounted), the result of the query has to be a store.
// stores can't be serialized in preload (understandably) so we're going to have to interact with the query document in
// the instance script and treat the module preload as an implementation detail to get the initial value for the store

// what this means in practice is that if we see a getQuery(graphql``) in the instance script of a component, we need to hoist
// it into the module's preload, grab the result and set it as the initial value in the store.

const posixify = (str: string) => str.replace(/\\/g, '/')

export default async function queryProcessor(
	config: Config,
	doc: TransformDocument
): Promise<void> {
	// if there is no module script we don't care about the document
	if (!doc.instance) {
		return
	}

	// how we preprocess a query depends on wether its a route/layout component
	const isRoute =
		config.framework !== 'svelte' &&
		!config.static &&
		posixify(doc.filename).startsWith(posixify(path.join(config.projectRoot, 'src', 'routes')))

	// figure out the root type
	const rootType = doc.config.schema.getQueryType()
	if (!rootType) {
		throw new Error('Could not find operation type')
	}

	// we need to keep a list of the queries that are fired in this document
	// note: we'll  replace the tags as we discover them with something the runtime library can use
	const queries: EmbeddedGraphqlDocument[] = []

	// remember the function that the document is passed to
	let functionNames: { [queryName: string]: string } = {}

	// go to every graphql document
	await walkTaggedDocuments(config, doc, doc.instance.content, {
		// with only one definition defining a fragment
		// note: the tags that satisfy this predicate will be added to the watch list
		where(graphqlDoc: graphql.DocumentNode) {
			return (
				graphqlDoc.definitions.length === 1 &&
				graphqlDoc.definitions[0].kind === graphql.Kind.OPERATION_DEFINITION &&
				graphqlDoc.definitions[0].operation === 'query'
			)
		},
		// we want to replace it with an object that the runtime can use
		onTag(tag: EmbeddedGraphqlDocument) {
			// pull out what we need
			const { node, parsedDocument, parent, artifact, tagContent } = tag

			// add the document to the list
			queries.push(tag)

			// the "actual" value of a template tag depends on wether its a route or component
			node.replaceWith(
				// a non-route needs a little more information than the handler to fetch
				// the query on mount
				AST.objectExpression(
					[
						AST.objectProperty(AST.identifier('store'), storeIdentifier(artifact)),
						AST.objectProperty(
							AST.identifier('component'),
							AST.booleanLiteral(!isRoute)
						),
					].concat(
						...(isRoute
							? []
							: [
									AST.objectProperty(
										AST.identifier('getProps'),
										AST.arrowFunctionExpression([], AST.identifier('$$props'))
									),
							  ])
					)
				)
			)
		},
	})

	// if there are no queries don't do anything
	if (queries.length === 0) {
		return
	}

	// now that we've walked over the document and collected every query doc
	// we need to hoist the queries to a preload function in the module

	// make sure there is a module script
	if (!doc.module) {
		doc.module = {
			start: 0,
			end: 0,
			// @ts-ignore
			content: AST.program([]),
		}
	}

	// if we are processing a route, use those processors
	if (isRoute) {
		processModule(config, doc.module!, queries)
	} else {
		// we need to make sure to import all of the artifacts in the instance script
		// every document will need to be imported
		for (const document of queries) {
			doc.instance.content.body.unshift(storeImport(config, document.artifact))
		}
	}
}

function processModule(config: Config, script: Script, queries: EmbeddedGraphqlDocument[]) {
	// the main thing we are responsible for here is to add the module bits of the
	// hoisted query. this means doing the actual fetch, checking errors, and returning
	// the props to the rendered components.

	// in order to reduce complexity in this code generation, we are going to build
	// the load function for sveltekit and then wrap it up for sapper if we need to

	// every document will need to be imported
	for (const document of queries) {
		script.content.body.unshift(storeImport(config, document.artifact))
	}

	// if there is already a load function, don't do anything
	if (findExportedFunction(script.content.body, 'load')) {
		return
	}

	// add the kit preload function
	addKitLoad(config, script.content.body, queries)

	// if we are processing this file for sapper, we need to add the actual preload function
	if (config.framework === 'sapper') {
		addSapperPreload(config, script.content.body)
	}
}

function addKitLoad(config: Config, body: Statement[], queries: EmbeddedGraphqlDocument[]) {
	// look for any hooks
	let beforeLoadDefinition = findExportedFunction(body, 'beforeLoad')
	let afterLoadDefinition = findExportedFunction(body, 'afterLoad')
	let onLoadDefinition = findExportedFunction(body, 'onLoad')

	// if there are any hooks, warn the user they will be gone soon
	if (beforeLoadDefinition || afterLoadDefinition || onLoadDefinition) {
		console.warn(
			'Query hooks are deprecated and will be removed soon. For more information please see the 0.15.0 migration doc: <link>.'
		)
	}

	// the name of the variable
	const requestContext = AST.identifier('_houdini_context')

	const preloadFn = AST.functionDeclaration(
		AST.identifier('load'),
		[AST.identifier('context')],
		// return an object
		AST.blockStatement([
			AST.returnStatement(
				AST.memberExpression(requestContext, AST.identifier('returnValue'))
			),
		])
	)
	// mark the function as async
	preloadFn.async = true

	// export the function from the module
	body.push(AST.exportNamedDeclaration(preloadFn) as ExportNamedDeclaration)

	const retValue = AST.memberExpression(requestContext, AST.identifier('returnValue'))

	// we can start inserting statements at the top of the function
	let insertIndex = 0

	// instantiate the context variable and then thread it through instead of passing `this` directly
	// then look to see if `this.error`, `this.redirect` were called before continuing onto the fetch
	preloadFn.body.body.splice(
		insertIndex,
		0,
		// @ts-ignore
		AST.variableDeclaration('const', [
			AST.variableDeclarator(
				requestContext,
				AST.newExpression(AST.identifier('RequestContext'), [AST.identifier('context')])
			),
		])
	)

	// we just added one to the return index
	insertIndex++

	// only split into promise and await if there are multiple queries
	const needsPromises = queries.length > 1
	// a list of statements to await the query promises and check the results for errors
	const awaitsAndChecks: StatementKind[] = []

	// every query that we found needs to be triggered in this function
	for (const document of queries) {
		let nextIndex = insertIndex

		const operation = document.parsedDocument.definitions[0] as graphql.OperationDefinitionNode

		// figure out the local variable that holds the result
		const preloadKey = preloadPayloadKey(operation)

		// the identifier for the query variables
		const variableIdentifier = variablesKey(operation)

		const hasVariables = Boolean(operation.variableDefinitions?.length)

		// add a local variable right before the return statement
		preloadFn.body.body.splice(
			nextIndex++,
			0,
			AST.variableDeclaration('const', [
				AST.variableDeclarator(
					AST.identifier(variableIdentifier),
					hasVariables
						? AST.callExpression(
								AST.memberExpression(
									requestContext,
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
											AST.identifier(
												queryInputFunction(document.artifact.name)
											)
										),
										AST.objectProperty(
											AST.literal('artifact'),
											artifactIdentifier(document.artifact)
										),
									]),
								]
						  )
						: AST.objectExpression([])
				),
			])
		)

		if (hasVariables) {
			preloadFn.body.body.splice(
				nextIndex++,
				0,
				// if we ran into a problem computing the variables
				AST.ifStatement(
					AST.unaryExpression(
						'!',
						AST.memberExpression(requestContext, AST.identifier('continue'))
					),
					AST.blockStatement([AST.returnStatement(retValue)])
				)
			)
		}

		const fetchCall = AST.callExpression(
			AST.memberExpression(storeIdentifier(document.artifact), AST.identifier('load')),
			[
				AST.identifier('context'),
				AST.objectExpression([
					AST.objectProperty(
						AST.literal('variables'),
						AST.identifier(variableIdentifier)
					),
				]),
			]
		)

		const errorCheck = AST.ifStatement(
			AST.unaryExpression(
				'!',
				AST.memberExpression(
					AST.memberExpression(AST.identifier(preloadKey), AST.identifier('result')),
					AST.identifier('data')
				)
			),
			AST.blockStatement([
				AST.expressionStatement(
					AST.callExpression(
						AST.memberExpression(requestContext, AST.identifier('graphqlErrors')),
						[AST.memberExpression(AST.identifier(preloadKey), AST.identifier('result'))]
					)
				),
				AST.returnStatement(retValue),
			])
		)

		if (needsPromises) {
			// local variable for holding the query promise
			const preloadPromiseKey = `${preloadKey}Promise`

			preloadFn.body.body.splice(
				nextIndex++,
				0,
				// a variable holding the query promise
				AST.variableDeclaration('const', [
					AST.variableDeclarator(AST.identifier(preloadPromiseKey), fetchCall),
				])
			)

			awaitsAndChecks.splice(
				0,
				0,
				// await the promise
				AST.variableDeclaration('const', [
					AST.variableDeclarator(
						AST.identifier(preloadKey),
						AST.awaitExpression(AST.identifier(preloadPromiseKey))
					),
				]),
				// we need to look for errors in the response
				errorCheck
			)
		} else {
			preloadFn.body.body.splice(
				nextIndex++,
				0,
				// @ts-ignore
				// perform the fetch and save the value under {preloadKey}
				AST.variableDeclaration('const', [
					AST.variableDeclarator(
						AST.identifier(preloadKey),
						AST.awaitExpression(fetchCall)
					),
				]),
				// we need to look for errors in the response
				errorCheck
			)
		}
	}

	// add all awaits and checks
	preloadFn.body.body.splice(-1, 0, ...awaitsAndChecks)

	// add calls to user before/after load functions
	if (beforeLoadDefinition || afterLoadDefinition || onLoadDefinition) {
		let context = [requestContext, config, queries] as const

		if (beforeLoadDefinition) {
			preloadFn.body.body.splice(
				insertIndex,
				0,
				...loadHookStatements('beforeLoad', ...context)
			)
		} else if (onLoadDefinition) {
			preloadFn.body.body.splice(insertIndex, 0, ...loadHookStatements('onLoad', ...context))
		}

		if (afterLoadDefinition) {
			preloadFn.body.body.splice(-1, 0, ...loadHookStatements('afterLoad', ...context))
		}
	}
}

function addSapperPreload(config: Config, body: Statement[]) {
	// make sure we have the utility that will do the conversion
	ensureImports(config, body, ['convertKitPayload'])

	// look for a preload definition
	let preloadDefinition = findExportedFunction(body, 'preload')

	// if there isn't one, add it
	if (preloadDefinition) {
		throw new Error('Cannot have a query where there is already a preload() defined')
	}

	// define the preload function
	const preloadFn = AST.functionDeclaration(
		AST.identifier('preload'),
		[AST.identifier('page'), AST.identifier('session')],
		// all we need to do is invoke the utility
		AST.blockStatement([
			AST.returnStatement(
				AST.callExpression(AST.identifier('convertKitPayload'), [
					AST.thisExpression(),
					AST.identifier('load'),
					AST.identifier('page'),
					AST.identifier('session'),
				])
			),
		])
	)

	// export the function from the module
	body.push(AST.exportNamedDeclaration(preloadFn) as ExportNamedDeclaration)
}

function loadHookStatements(
	name: 'beforeLoad' | 'afterLoad' | 'onLoad',
	requestContext: namedTypes.Identifier,
	config: Config,
	queries: EmbeddedGraphqlDocument[]
) {
	if (name === 'onLoad') {
		console.warn(
			'Warning: Houdini `onLoad` hook has been renamed to `beforeLoad`. ' +
				'Support for onLoad will be removed in an upcoming release'
		)
	}
	return [
		AST.expressionStatement(
			AST.awaitExpression(
				AST.callExpression(
					AST.memberExpression(requestContext, AST.identifier('invokeLoadHook')),
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
											afterLoadQueryData(queries)
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

function afterLoadQueryInput(queries: EmbeddedGraphqlDocument[]) {
	return AST.objectExpression(
		queries.map(({ parsedDocument: { definitions } }) =>
			AST.objectProperty(
				AST.literal(
					(definitions[0] as graphql.OperationDefinitionNode)?.name?.value || null
				),
				AST.identifier(variablesKey(definitions[0] as graphql.OperationDefinitionNode))
			)
		)
	)
}

function afterLoadQueryData(queries: EmbeddedGraphqlDocument[]) {
	return AST.objectExpression(
		queries.map(({ parsedDocument: { definitions } }) =>
			AST.objectProperty(
				AST.literal(
					(definitions[0] as graphql.OperationDefinitionNode)?.name?.value || null
				),
				AST.memberExpression(
					AST.memberExpression(
						AST.identifier(
							preloadPayloadKey(definitions[0] as graphql.OperationDefinitionNode)
						),
						AST.identifier('result')
					),
					AST.identifier('data')
				)
			)
		)
	)
}

function preloadPayloadKey(operation: graphql.OperationDefinitionNode): string {
	return `_${operation.name?.value}`
}

function queryHandlerIdentifier(operation: graphql.OperationDefinitionNode): namedTypes.Identifier {
	return AST.identifier(`_${operation.name?.value}_handler`)
}

function variablesKey(operation: graphql.OperationDefinitionNode): string {
	return `_${operation.name?.value}_Input`
}

function queryInputFunction(name: string) {
	return `${name}Variables`
}

function findExportedFunction(body: Statement[], name: string): ExportNamedDeclaration | null {
	return body.find(
		(expression) =>
			expression.type === 'ExportNamedDeclaration' &&
			expression.declaration?.type === 'FunctionDeclaration' &&
			expression.declaration?.id?.name === name
	) as ExportNamedDeclaration
}
