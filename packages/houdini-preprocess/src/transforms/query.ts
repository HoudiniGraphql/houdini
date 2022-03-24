// externals
import * as recast from 'recast'
import * as graphql from 'graphql'
import { ExportNamedDeclaration, ReturnStatement, Statement } from '@babel/types'
import { Config, Script } from 'houdini-common'
import { namedTypes } from 'ast-types/gen/namedTypes'
import { ObjectExpressionKind } from 'ast-types/gen/kinds'
import path from 'path'
// locals
import { TransformDocument } from '../types'
import {
	walkTaggedDocuments,
	EmbeddedGraphqlDocument,
	artifactImport,
	artifactIdentifier,
	ensureImports,
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

			// dry up some values
			const operation = parsedDocument.definitions[0] as graphql.OperationDefinitionNode
			const handlerIdentifier = queryHandlerIdentifier(operation)

			// the "actual" value of a template tag depends on wether its a route or component
			node.replaceWith(
				// a non-route needs a little more information than the handler to fetch
				// the query on mount
				AST.objectExpression([
					AST.objectProperty(AST.identifier('queryHandler'), handlerIdentifier),
					AST.objectProperty(AST.identifier('config'), AST.identifier('houdiniConfig')),
					AST.objectProperty(
						AST.identifier('artifact'),
						AST.identifier(artifactIdentifier(artifact))
					),
					AST.objectProperty(
						AST.identifier('variableFunction'),
						operation.variableDefinitions && operation.variableDefinitions.length > 0
							? AST.identifier(queryInputFunction(artifact.name))
							: AST.nullLiteral()
					),
					AST.objectProperty(
						AST.identifier('getProps'),
						AST.arrowFunctionExpression([], AST.identifier('$$props'))
					),
				])
			)

			// we also need to wrap the template tag in a function that knows how to convert the query
			// handler into a value that's useful for the operation context (route vs component)
			const callParent = parent as namedTypes.CallExpression
			if (callParent.type === 'CallExpression' && callParent.callee.type === 'Identifier') {
				// need to make sure that we call the same function we were passed to
				functionNames[artifactIdentifier(artifact)] = callParent.callee.name
				// update the function called for the environment
				callParent.callee.name = isRoute ? 'routeQuery' : 'componentQuery'
			}
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
			doc.instance.content.body.unshift(artifactImport(config, document.artifact))
		}
	}
	processInstance(config, isRoute, doc.instance, queries, functionNames)
}

function processModule(config: Config, script: Script, queries: EmbeddedGraphqlDocument[]) {
	// the main thing we are responsible for here is to add the module bits of the
	// hoisted query. this means doing the actual fetch, checking errors, and returning
	// the props to the rendered components.

	// in order to reduce complexity in this code generation, we are going to build
	// the load function for sveltekit and then wrap it up for sapper if we need to

	// every document will need to be imported
	for (const document of queries) {
		script.content.body.unshift(artifactImport(config, document.artifact))
	}

	// add the imports if they're not there
	ensureImports(config, script.content.body, ['fetchQuery', 'RequestContext'])

	// add the kit preload function
	addKitLoad(config, script.content.body, queries)

	// if we are processing this file for sapper, we need to add the actual preload function
	if (config.framework === 'sapper') {
		addSapperPreload(config, script.content.body)
	}
}

function processInstance(
	config: Config,
	isRoute: boolean,
	script: Script,
	queries: EmbeddedGraphqlDocument[],
	functionNames: { [artifactName: string]: string }
) {
	// make sure we have the imports we need
	ensureImports(config, script.content.body, ['routeQuery', 'componentQuery', 'query'])

	// add props to the component for every query while we're here

	// find the first non import statement
	const propInsertIndex = script.content.body.findIndex(
		(expression) => expression.type !== 'ImportDeclaration'
	)

	// this happens for every document in the page, make sure we handle that correctly.

	// every query document we ran into creates a local variable as well as a new key in the returned value of
	// the preload function as well as a prop declaration in the instance script
	for (const document of queries) {
		const operation = document.parsedDocument.definitions[0] as graphql.OperationDefinitionNode
		// figure out the local variable that holds the result
		const preloadKey = preloadPayloadKey(operation)

		const { artifact, parsedDocument } = document

		// prop declarations needs to be added to the top of the document
		script.content.body.splice(
			propInsertIndex,
			0,
			// @ts-ignore: babel's ast does something weird with comments, we won't use em
			AST.exportNamedDeclaration(
				AST.variableDeclaration('let', [
					AST.variableDeclarator(AST.identifier(preloadKey), AST.identifier('undefined')),
				])
			),
			AST.variableDeclaration('let', [
				AST.variableDeclarator(
					queryHandlerIdentifier(operation),
					AST.callExpression(
						AST.identifier(functionNames[artifactIdentifier(artifact)]),
						[
							AST.objectExpression([
								AST.objectProperty(
									AST.stringLiteral('config'),
									AST.identifier('houdiniConfig')
								),
								AST.objectProperty(
									AST.stringLiteral('initialValue'),
									AST.memberExpression(
										AST.identifier(preloadPayloadKey(operation)),
										AST.identifier('result')
									)
								),
								AST.objectProperty(
									AST.stringLiteral('variables'),
									AST.memberExpression(
										AST.identifier(preloadPayloadKey(operation)),
										AST.identifier('variables')
									)
								),
								AST.objectProperty(
									AST.literal('kind'),
									AST.stringLiteral(artifact.kind)
								),
								AST.objectProperty(
									AST.literal('artifact'),
									AST.identifier(artifactIdentifier(artifact))
								),
								AST.objectProperty(
									AST.literal('source'),
									AST.memberExpression(
										AST.identifier(preloadPayloadKey(operation)),
										AST.identifier('source')
									)
								),
							]),
						]
					)
				),
			])
		)

		// reactive statements to synchronize state with query updates need to be at the bottom (where everything
		// will have a definition)
		if (isRoute) {
			script.content.body.push(
				// @ts-ignore: babel's ast does something weird with comments, we won't use em
				AST.labeledStatement(
					AST.identifier('$'),
					AST.blockStatement([
						AST.expressionStatement(
							AST.callExpression(
								AST.memberExpression(
									queryHandlerIdentifier(operation),
									AST.identifier('onLoad')
								),
								[AST.identifier(preloadKey)]
							)
						),
					])
				)
			)
		}
	}
}

function addKitLoad(config: Config, body: Statement[], queries: EmbeddedGraphqlDocument[]) {
	// look for a preload definition
	let preloadDefinition = findExportedFunction(body, 'load')
	// if there isn't one, add it
	if (preloadDefinition) {
		throw new Error('Cannot have a query where there is already a load() defined')
	}

	let beforeLoadDefinition = findExportedFunction(body, 'beforeLoad')
	let afterLoadDefinition = findExportedFunction(body, 'afterLoad')
	let onLoadDefinition = findExportedFunction(body, 'onLoad')

	const preloadFn = AST.functionDeclaration(
		AST.identifier('load'),
		[AST.identifier('context')],
		// return an object
		AST.blockStatement([AST.returnStatement(AST.objectExpression([]))])
	)
	// mark the function as async
	preloadFn.async = true

	// export the function from the module
	body.push(AST.exportNamedDeclaration(preloadFn) as ExportNamedDeclaration)

	// the name of the variable
	const requestContext = AST.identifier('_houdini_context')

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
	// grab the return statement so we can add stuff to it later
	let returnValue = (preloadFn.body.body[insertIndex] as ReturnStatement)
		.argument as ObjectExpressionKind

	// hold onto the props object in
	let propsProperty = returnValue.properties.find(
		(prop) =>
			prop.type === 'ObjectProperty' &&
			prop.key.type === 'StringLiteral' &&
			prop.key.value === 'props'
	) as namedTypes.ObjectProperty
	if (!propsProperty) {
		// define the property so we can pull out the inner object
		propsProperty = AST.objectProperty(AST.identifier('props'), AST.objectExpression([]))

		// add the property to the return value
		returnValue.properties.push(propsProperty)
	}
	let propsValue = propsProperty.value as namedTypes.ObjectExpression

	// every query that we found needs to be triggered in this function
	for (const document of queries) {
		const operation = document.parsedDocument.definitions[0] as graphql.OperationDefinitionNode

		// figure out the local variable that holds the result
		const preloadKey = preloadPayloadKey(operation)

		// the identifier for the query variables
		const variableIdentifier = variablesKey(operation)

		// add a local variable right before the return statement
		preloadFn.body.body.splice(
			insertIndex,
			0,
			AST.variableDeclaration('const', [
				AST.variableDeclarator(
					AST.identifier(variableIdentifier),
					operation.variableDefinitions && operation.variableDefinitions.length > 0
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
											AST.literal('mode'),
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
											AST.identifier(artifactIdentifier(document.artifact))
										),
									]),
								]
						  )
						: AST.objectExpression([])
				),
			]),
			// if we ran into a problem computing the variables
			AST.ifStatement(
				AST.unaryExpression(
					'!',
					AST.memberExpression(requestContext, AST.identifier('continue'))
				),
				AST.blockStatement([AST.returnStatement(retValue)])
			),
			// @ts-ignore
			// perform the fetch and save the value under {preloadKey}
			AST.variableDeclaration('const', [
				AST.variableDeclarator(
					AST.identifier(preloadKey),
					AST.awaitExpression(
						AST.callExpression(AST.identifier('fetchQuery'), [
							AST.objectExpression([
								AST.objectProperty(
									AST.literal('context'),
									AST.identifier('context')
								),
								AST.objectProperty(
									AST.literal('artifact'),
									AST.identifier(artifactIdentifier(document.artifact))
								),
								AST.objectProperty(
									AST.literal('variables'),
									AST.identifier(variableIdentifier)
								),
								AST.objectProperty(
									AST.literal('session'),

									AST.memberExpression(
										AST.identifier('context'),
										AST.identifier('session')
									)
								),
							]),
						])
					)
				),
				,
			]),

			// we need to look for errors in the response
			AST.ifStatement(
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
							[AST.identifier(preloadKey)]
						)
					),
					AST.returnStatement(retValue),
				])
			)
		)

		// add the field to the return value of preload
		propsValue.properties.push(
			AST.objectProperty(
				AST.identifier(preloadKey),
				AST.objectExpression([
					AST.spreadProperty(AST.identifier(preloadKey)),
					AST.objectProperty(
						AST.identifier('variables'),
						AST.identifier(variableIdentifier)
					),
				])
			)
		)
	}

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

		const beforeHookReturn = AST.identifier('beforeHookReturn')
		const afterHookReturn = AST.identifier('afterHookReturn')

		let hookReturn = AST.identifier('hookReturn')
		if (beforeLoadDefinition || onLoadDefinition) {
			preloadFn.body.body.splice(
				// jump over the hook call itself and the check for errors
				insertIndex + 2,
				0,
				AST.variableDeclaration('const', [
					AST.variableDeclarator(beforeHookReturn, retValue),
				])
			)

			hookReturn = beforeHookReturn
		}

		if (afterLoadDefinition) {
			preloadFn.body.body.splice(
				-1,
				0,
				...loadHookStatements('afterLoad', ...context),
				AST.variableDeclaration('const', [
					AST.variableDeclarator(afterHookReturn, retValue),
				])
			)

			hookReturn = afterHookReturn
		}

		if ((beforeLoadDefinition || onLoadDefinition) && afterLoadDefinition) {
			hookReturn = AST.identifier('hookReturn')

			preloadFn.body.body.splice(
				-1,
				0,
				// shallow merge before/after returns
				AST.variableDeclaration('const', [
					AST.variableDeclarator(
						hookReturn,
						AST.objectExpression([
							AST.spreadProperty(beforeHookReturn),
							AST.spreadProperty(afterHookReturn),
						])
					),
				]),
				// merge specific keys
				...['props', 'stuff'].map(AST.identifier).map((id) =>
					AST.ifStatement(
						// this is true if before and/or after hook returned this key
						AST.memberExpression(hookReturn, id),
						AST.blockStatement([
							AST.expressionStatement(
								AST.assignmentExpression(
									'=',
									AST.memberExpression(hookReturn, id),
									AST.objectExpression([
										AST.spreadProperty(
											AST.memberExpression(beforeHookReturn, id)
										),
										AST.spreadProperty(
											AST.memberExpression(afterHookReturn, id)
										),
									])
								)
							),
						])
					)
				)
			)
		}

		// if the hook return has keys 'props' or 'stuff' we need special handling
		preloadFn.body.body.splice(
			-1,
			0,
			AST.ifStatement(
				AST.logicalExpression(
					'||',
					AST.memberExpression(hookReturn, AST.identifier('props')),
					AST.memberExpression(hookReturn, AST.identifier('stuff'))
				),
				AST.blockStatement([
					AST.returnStatement(
						AST.objectExpression([
							AST.spreadProperty(hookReturn),
							AST.objectProperty(
								AST.identifier('props'),
								AST.objectExpression([
									...propsValue.properties,
									AST.spreadProperty(
										AST.memberExpression(hookReturn, AST.identifier('props'))
									),
								])
							),
						])
					),
				])
			)
		)

		// add the returnValue of the load hooks to the return value of pre(load)
		propsValue.properties.push(
			// @ts-ignore
			AST.spreadProperty(hookReturn)
		)
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
								AST.literal('mode'),
								AST.stringLiteral(config.framework)
							),
							AST.objectProperty(AST.literal('hookFn'), AST.identifier(name)),
							// after load: pass query data to the hook
							...(name === 'afterLoad'
								? [
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
		// if any hook function returned an error or redirect
		AST.ifStatement(
			AST.unaryExpression(
				'!',
				AST.memberExpression(requestContext, AST.identifier('continue'))
			),
			AST.blockStatement([
				AST.returnStatement(
					AST.memberExpression(requestContext, AST.identifier('returnValue'))
				),
			])
		),
	]
}

function afterLoadQueryData(queries: EmbeddedGraphqlDocument[]) {
	return AST.objectExpression(
		queries.map(({ parsedDocument: { definitions } }) =>
			AST.objectProperty(
				AST.literal(
					(definitions[0] as graphql.OperationDefinitionNode)?.name?.value || null
				),
				AST.memberExpression(
					AST.identifier(
						preloadPayloadKey(definitions[0] as graphql.OperationDefinitionNode)
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

function preloadsourceKey(operation: graphql.OperationDefinitionNode): string {
	return `_${operation.name?.value}_Source`
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
