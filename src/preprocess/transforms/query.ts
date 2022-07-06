// externals
import * as recast from 'recast'
import * as graphql from 'graphql'
import { namedTypes } from 'ast-types/gen/namedTypes'
import { StatementKind } from 'ast-types/gen/kinds'
import path from 'path'
// locals
import {
	Config,
	Script,
	ensureImports,
	ensureArtifactImport,
	ensureStoreFactoryImport,
} from '../../common'
import { TransformDocument } from '../types'
import { walkTaggedDocuments, EmbeddedGraphqlDocument } from '../utils'
import { ArtifactKind } from '../../runtime/lib/types'
import { ExportNamedDeclaration, VariableDeclaration } from '@babel/types'
const AST = recast.types.builders
import { Statement } from '@babel/types'

type Identifier = ReturnType<typeof recast.types.builders.identifier>

// in order for query values to update when mutations fire (after the component has mounted), the result of the query has to be a store.
// stores can't be serialized in preload (understandably) so we're going to have to interact with the query document in
// the instance script and treat the module preload as an implementation detail to get the initial value for the store

// what this means in practice is that if we see a getQuery(graphql``) in the instance script of a component, we need to hoist
// it into the module's preload, grab the result and set it as the initial value in the store.

export default async function queryProcessor(
	config: Config,
	doc: TransformDocument
): Promise<void> {
	// if there is no module script we don't care about the document
	if (!doc.instance) {
		return
	}

	// how we preprocess a query depends on wether its a route/layout component
	const isRoute = config.isRoute(doc.filename)

	// figure out the root type
	const rootType = doc.config.schema.getQueryType()
	if (!rootType) {
		throw new Error('Could not find operation type')
	}

	// we need to keep a list of the queries that are fired in this document
	// note: we'll  replace the tags as we discover them with something the runtime library can use
	const queries: EmbeddedGraphqlDocument[] = []

	let artifactImportIDs: { [name: string]: string } = {}
	let storeIdentifiers: { [name: string]: Identifier } = {}
	let storeFactories: { [name: string]: Identifier } = {}
	let hasVariables: { [name: string]: boolean } = {}

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
			const operation = parsedDocument.definitions[0] as graphql.OperationDefinitionNode

			// add the document to the list
			queries.push(tag)

			// add imports for the appropriate store and artifact
			storeFactories[artifact.name] = AST.identifier(
				ensureStoreFactoryImport({
					config,
					body: isRoute ? doc.module!.content.body : doc.instance!.content.body,
					artifact,
				})[0]
			)

			storeIdentifiers[artifact.name] = AST.identifier(
				`store_${storeFactories[artifact.name].name}`
			)

			artifactImportIDs[artifact.name] = ensureArtifactImport({
				config,
				body: isRoute ? doc.module!.content.body : doc.instance!.content.body,
				artifact: artifact,
			})

			// check if there is a variable function defined
			hasVariables[artifact.name] = Boolean(
				doc.module!.content.body.find(
					(statement) =>
						statement.type === 'ExportNamedDeclaration' &&
						statement.declaration?.type === 'FunctionDeclaration' &&
						statement.declaration.id?.name === queryInputFunction(artifact.name)
				)
			)

			// TODO: check if there is at least one required input and tell them they need to define
			// a variable functino

			// the "actual" value of a template tag depends on wether its a route or component
			node.replaceWith(
				// a non-route needs a little more information than the handler to fetch
				// the query on mount
				AST.objectExpression([
					AST.objectProperty(
						AST.identifier('kind'),
						AST.stringLiteral(ArtifactKind.Query)
					),
					AST.objectProperty(AST.identifier('store'), storeIdentifiers[artifact.name]),
					AST.objectProperty(AST.identifier('config'), AST.identifier('houdiniConfig')),
					AST.objectProperty(
						AST.identifier('artifact'),
						AST.identifier(artifactImportIDs[artifact.name])
					),
				])
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
		processModule({
			config,
			script: doc.module!,
			queries,
			artifactImportIDs,
			storeIdentifiers,
			storeFactories,
			hasVariables,
		})
	}

	// add the necessary bits to the instance script
	processInstance({
		config,
		script: doc.instance,
		queries,
		storeIdentifiers,
		storeFactories,
		isRoute,
		artifactImportIDs,
		hasVariables,
	})
}

function processModule({
	config,
	script,
	queries,
	artifactImportIDs,
	storeIdentifiers,
	storeFactories,
	hasVariables,
}: {
	config: Config
	script: Script
	queries: EmbeddedGraphqlDocument[]
	artifactImportIDs: { [name: string]: string }
	storeIdentifiers: { [name: string]: Identifier }
	storeFactories: { [name: string]: Identifier }
	hasVariables: { [operationName: string]: boolean }
}) {
	// the main thing we are responsible for here is to add the module bits of the
	// hoisted query. this means doing the actual fetch, checking errors, and returning
	// the props to the rendered components.

	// in order to reduce complexity in this code generation, we are going to build
	// the load function for sveltekit and then wrap it up for sapper if we need to

	ensureImports({
		config,
		body: script.content.body,
		import: ['RequestContext'],
		sourceModule: '$houdini/runtime',
	})

	// if there is already a load function, don't do anything
	if (findExportedFunction(script.content.body, 'load')) {
		return
	}

	// we need to instantiate copies of the the stores that the load and component content will reference
	// these statements have to go after the last import
	let insertIndex = script.content.body.findIndex(
		(expression) => expression.type !== 'ImportDeclaration'
	)
	for (const query of queries) {
		const name = (query.parsedDocument.definitions[0] as graphql.OperationDefinitionNode).name!
			.value
		script.content.body.splice(
			insertIndex,
			0,
			// @ts-expect-error
			AST.variableDeclaration('const', [
				AST.variableDeclarator(
					storeIdentifiers[name],
					AST.callExpression(storeFactories[name], [])
				),
			])
		)
	}

	// add the kit preload function
	addKitLoad({
		config,
		body: script.content.body,
		queries,
		artifactImportIDs,
		storeIdentifiers,
		hasVariables,
	})

	// if we are processing this file for sapper, we need to add the actual preload function
	if (config.framework === 'sapper') {
		addSapperPreload(config, script.content.body)
	}
}

function addKitLoad({
	config,
	body,
	queries,
	artifactImportIDs,
	storeIdentifiers,
	hasVariables,
}: {
	config: Config
	body: Statement[]
	queries: EmbeddedGraphqlDocument[]
	artifactImportIDs: { [name: string]: string }
	storeIdentifiers: { [name: string]: Identifier }
	hasVariables: { [operationName: string]: boolean }
}) {
	// look for any hooks
	let beforeLoadDefinition = findExportedFunction(body, 'beforeLoad')
	let afterLoadDefinition = findExportedFunction(body, 'afterLoad')
	let onLoadDefinition = findExportedFunction(body, 'onLoad')

	// the name of the variable
	const requestContext = AST.identifier('_houdini_context')

	const preloadFn = AST.functionDeclaration(
		AST.identifier('load'),
		[AST.identifier('context')],
		// return an object
		AST.blockStatement([
			AST.returnStatement(
				AST.objectExpression([
					AST.spreadElement(
						AST.memberExpression(requestContext, AST.identifier('returnValue'))
					),
					AST.objectProperty(
						AST.identifier('props'),
						AST.objectExpression([
							AST.spreadElement(
								AST.memberExpression(
									AST.memberExpression(
										requestContext,
										AST.identifier('returnValue')
									),
									AST.identifier('props')
								)
							),
							...queries.map((query) => {
								const identifier = AST.identifier(
									variablesKey(query.parsedDocument.definitions[0])
								)

								return AST.objectProperty(identifier, identifier)
							}),
						])
					),
				])
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

		const name = operation.name!.value

		// add a local variable right before the return statement
		preloadFn.body.body.splice(
			nextIndex++,
			0,
			AST.variableDeclaration('const', [
				AST.variableDeclarator(
					AST.identifier(variableIdentifier),
					hasVariables[name]
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
											AST.identifier(
												artifactImportIDs[document.artifact.name]
											)
										),
									]),
								]
						  )
						: AST.objectExpression([])
				),
			])
		)

		if (hasVariables[name]) {
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
			AST.memberExpression(storeIdentifiers[document.artifact.name], AST.identifier('fetch')),
			[
				AST.objectExpression([
					AST.objectProperty(
						AST.literal('variables'),
						AST.identifier(variableIdentifier)
					),
					AST.objectProperty(AST.literal('event'), AST.identifier('context')),
					AST.objectProperty(
						AST.literal('blocking'),
						AST.booleanLiteral(!!afterLoadDefinition)
					),
				]),
			]
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
				])
			)
		} else {
			preloadFn.body.body.splice(
				nextIndex++,
				0,
				// perform the fetch and save the value under {preloadKey}
				AST.variableDeclaration('const', [
					AST.variableDeclarator(
						AST.identifier(preloadKey),
						AST.awaitExpression(fetchCall)
					),
				])
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
	ensureImports({
		config,
		body,
		import: ['convertKitPayload'],
		sourceModule: '$houdini/runtime',
	})

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
				AST.identifier(variablesKey(definitions[0]))
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
					AST.identifier(
						preloadPayloadKey(definitions[0] as graphql.OperationDefinitionNode)
					),
					AST.identifier('data')
				)
			)
		)
	)
}

function processInstance({
	config,
	script,
	queries,
	storeIdentifiers,
	storeFactories,
	artifactImportIDs,
	hasVariables,
	isRoute,
}: {
	config: Config
	script: Script
	queries: EmbeddedGraphqlDocument[]
	storeIdentifiers: { [name: string]: Identifier }
	storeFactories: { [name: string]: Identifier }
	artifactImportIDs: { [operationName: string]: string }
	hasVariables: { [operationName: string]: boolean }
	isRoute: boolean
}) {
	// make sure we imported the
	ensureImports({
		config,
		body: script.content.body,
		import: ['getHoudiniContext', 'isBrowser'],
		sourceModule: '$houdini/runtime',
	})

	// any prop declarations and statements need to come after the first import
	let propInsertIndex = script.content.body.findIndex(
		(expression) => expression.type !== 'ImportDeclaration'
	)

	// find all of the props of the component by looking for export let
	const props = (script.content.body.filter(
		(statement) =>
			statement.type === 'ExportNamedDeclaration' &&
			statement.declaration?.type === 'VariableDeclaration'
	) as ExportNamedDeclaration[]).flatMap(({ declaration }) =>
		(declaration as VariableDeclaration)!.declarations.map((dec) => (dec.id as Identifier).name)
	)

	// if we are looking at a non-route component we need to create the store instance
	// since we dont have a generated load that defines them
	if (!isRoute) {
		for (const query of queries) {
			const operation = query.parsedDocument.definitions[0] as graphql.OperationDefinitionNode
			const name = operation.name!.value

			script.content.body.splice(
				propInsertIndex++,
				0,
				// @ts-expect-error
				AST.variableDeclaration('const', [
					AST.variableDeclarator(
						storeIdentifiers[name],
						AST.callExpression(storeFactories[name], [])
					),
				])
			)
		}
	}

	const contextIdentifier = AST.identifier('_houdini_context_generated_DONT_USE')

	// pull out the houdini context
	script.content.body.splice(
		propInsertIndex,
		0,
		// @ts-expect-error
		AST.variableDeclaration('const', [
			AST.variableDeclarator(
				contextIdentifier,
				AST.callExpression(AST.identifier('getHoudiniContext'), [])
			),
		])
	)

	// increment the insert counter so context variable is defined
	propInsertIndex++

	// add the necessary bits for every query in the page
	for (const query of queries) {
		const operation = query.parsedDocument.definitions[0] as graphql.OperationDefinitionNode
		const inputPropName = variablesKey(operation)
		const name = operation.name!.value

		let variableDeclaration: recast.types.namedTypes.Statement
		// in a route component, the variables are a prop
		if (isRoute) {
			variableDeclaration = AST.exportNamedDeclaration(
				AST.variableDeclaration('let', [
					AST.variableDeclarator(AST.identifier(inputPropName), AST.objectExpression([])),
				])
			)
		}
		// if we are processing a non-route, we need to label the variable and compute it in the component body
		else if (hasVariables[name]) {
			ensureImports({
				config,
				body: script.content.body,
				import: ['marshalInputs'],
				sourceModule: '$houdini/runtime/lib/scalars',
			})

			variableDeclaration = AST.labeledStatement(
				AST.identifier('$'),
				//
				AST.expressionStatement(
					AST.assignmentExpression(
						'=',
						AST.identifier(inputPropName),
						AST.callExpression(AST.identifier('marshalInputs'), [
							AST.objectExpression([
								AST.objectProperty(
									AST.identifier('config'),
									AST.identifier('houdiniConfig')
								),
								AST.objectProperty(
									AST.identifier('artifact'),
									AST.identifier(artifactImportIDs[name])
								),
								AST.objectProperty(
									AST.identifier('input'),
									AST.callExpression(
										AST.memberExpression(
											AST.identifier(queryInputFunction(name)),
											AST.identifier('call')
										),
										[
											contextIdentifier,
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
												AST.objectProperty(
													AST.identifier('session'),
													AST.memberExpression(
														contextIdentifier,
														AST.identifier('session')
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
		}
		// a component query without variables just uses an empty object as input
		else {
			variableDeclaration = AST.variableDeclaration('let', [
				AST.variableDeclarator(AST.identifier(inputPropName), AST.objectExpression([])),
			])
		}

		// make sure we have a prop for every input
		script.content.body.splice(
			propInsertIndex + 1,
			0,
			// @ts-expect-error: recast does not mesh with babel's comment AST. ignore it.
			variableDeclaration,
			AST.labeledStatement(
				AST.identifier('$'),
				AST.expressionStatement(
					AST.logicalExpression(
						'&&',
						AST.identifier('isBrowser'),
						AST.callExpression(
							AST.memberExpression(storeIdentifiers[name], AST.identifier('fetch')),
							[
								AST.objectExpression([
									AST.objectProperty(
										AST.literal('variables'),
										AST.identifier(inputPropName)
									),
									AST.objectProperty(AST.literal('context'), contextIdentifier),
								]),
							]
						)
					)
				)
			)
		)
	}
}

function preloadPayloadKey(operation: graphql.OperationDefinitionNode): string {
	return `_${operation.name?.value}`
}

function variablesKey(operation: graphql.DefinitionNode): string {
	return `_${(operation as graphql.OperationDefinitionNode).name?.value}_Input`
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
