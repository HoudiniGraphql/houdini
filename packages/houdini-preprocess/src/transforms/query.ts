// externals
import * as recast from 'recast'
import * as graphql from 'graphql'
import {
	ExportNamedDeclaration,
	FunctionDeclaration,
	ReturnStatement,
	ImportDeclaration,
} from '@babel/types'
import { Config, Script } from 'houdini-common'
import { DocumentArtifact } from 'houdini'
import { namedTypes } from 'ast-types/gen/namedTypes'
// locals
import { TransformDocument } from '../types'
import { walkTaggedDocuments, EmbeddedGraphqlDocument } from '../utils'
const AST = recast.types.builders

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

	// figure out the root type
	const rootType = doc.config.schema.getQueryType()
	if (!rootType) {
		throw new Error('Could not find operation type')
	}

	// we need to keep a list of the queries that are fired in this document
	// note: we'll  replace the tags as we discover them with something the runtime library can use
	const queries: EmbeddedGraphqlDocument[] = []

	// we need to keep track of

	// go to every graphql document
	await walkTaggedDocuments(doc, doc.instance.content, {
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
			const { node, parsedDocument, parent } = tag

			// add the document to the list
			queries.push(tag)

			// we're going to hoist the actual query so we need to replace the graphql tag with
			// a reference to the result
			node.replaceWith(
				queryHandlerIdentifier(
					parsedDocument.definitions[0] as graphql.OperationDefinitionNode
				)
			)

			// as well as change the name of query to something that will just pass the result through
			const callParent = parent as namedTypes.CallExpression
			if (callParent.type === 'CallExpression' && callParent.callee.type === 'Identifier') {
				callParent.callee.name = 'getQuery'
			}
		},
	})

	// if there are no queries dont do anything
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

	if (!doc.module) {
		throw new Error('type script!!')
	}

	processModule(config, doc.module, queries)
	processInstance(config, doc.instance, queries)
}

function processModule(config: Config, script: Script, queries: EmbeddedGraphqlDocument[]) {
	// look for a preload definition
	let preloadDefinition = script.content.body.find(
		(expression) =>
			expression.type === 'ExportNamedDeclaration' &&
			expression.declaration?.type === 'FunctionDeclaration' &&
			expression.declaration?.id?.name === 'preload'
	) as ExportNamedDeclaration
	// if there isn't one, add something that can take it place.
	// in this context, that means that there would be a return at the end of an object
	if (!preloadDefinition) {
		const preloadFn = AST.functionDeclaration(
			AST.identifier('preload'),
			[AST.identifier('page'), AST.identifier('session')],
			// return an object
			AST.blockStatement([AST.returnStatement(AST.objectExpression([]))])
		)
		// mark the function as async
		preloadFn.async = true

		// hold onto this new declaration
		preloadDefinition = AST.exportNamedDeclaration(preloadFn) as ExportNamedDeclaration

		// add it to the module
		script.content.body.push(preloadDefinition)
	}
	const preloadFn = preloadDefinition.declaration as FunctionDeclaration

	/// add the imports if they're  not there

	let fetchQueryImport = script.content.body.find(
		(statement) =>
			statement.type === 'ImportDeclaration' &&
			statement.source.value === 'houdini' &&
			statement.specifiers.find(
				(importSpecifier) =>
					importSpecifier.type === 'ImportSpecifier' &&
					importSpecifier.imported.type === 'Identifier' &&
					importSpecifier.imported.name === 'fetchQuery' &&
					importSpecifier.local.name === 'fetchQuery'
			)
	) as ImportDeclaration
	// add the import if it doesn't exist, add it
	if (!fetchQueryImport) {
		script.content.body.unshift({
			type: 'ImportDeclaration',
			// @ts-ignore
			source: AST.literal('$houdini'),
			specifiers: [
				// @ts-ignore
				AST.importSpecifier(AST.identifier('fetchQuery'), AST.identifier('fetchQuery')),
			],
		})
	}

	let requestCtxImport = script.content.body.find(
		(statement) =>
			statement.type === 'ImportDeclaration' &&
			statement.source.value === '$houdini' &&
			statement.specifiers.find(
				(importSpecifier) =>
					importSpecifier.type === 'ImportSpecifier' &&
					importSpecifier.imported.type === 'Identifier' &&
					importSpecifier.imported.name === 'RequestContext' &&
					importSpecifier.local.name === 'RequestContext'
			)
	) as ImportDeclaration
	// add the import if it doesn't exist, add it
	if (!requestCtxImport) {
		script.content.body.unshift({
			type: 'ImportDeclaration',
			// @ts-ignore
			source: AST.literal('$houdini'),
			specifiers: [
				// @ts-ignore
				AST.importSpecifier(
					AST.identifier('RequestContext'),
					AST.identifier('RequestContext')
				),
			],
		})
	}

	/// add the preloaded payload to the return statement

	// find the return statement in the preload function
	let returnStatementIndex = preloadFn.body.body.findIndex(
		({ type }) => type === 'ReturnStatement'
	)
	const returnStatement = preloadFn.body.body[returnStatementIndex] as ReturnStatement
	// if we couldn't find the return statement we need to yell
	if (
		!returnStatement ||
		!returnStatement.argument ||
		returnStatement.argument.type !== 'ObjectExpression'
	) {
		throw new Error('Could not find return statement to hoist query into')
	}
	const returnedValue = returnStatement.argument
	//// we need to wrap up the preload's this in something that we can integrate with

	// the name of the variable
	const requestContext = AST.identifier('_houdini_context')

	// TODO: look for a variable in the preload with a conflicting name

	// intantiate the context variable and then thread it through instead of passing `this` directly
	// then look to see if `this.error`, `this.redirect` were called before continuing onto the fetch
	preloadFn.body.body.splice(
		returnStatementIndex,
		0,
		// @ts-ignore
		AST.variableDeclaration('const', [
			AST.variableDeclarator(
				requestContext,
				AST.newExpression(AST.identifier('RequestContext'), [AST.thisExpression()])
			),
		])
	)

	// we just added one to the return index
	returnStatementIndex++

	for (const document of queries) {
		const operation = document.parsedDocument.definitions[0] as graphql.OperationDefinitionNode
		// figure out the local variable that holds the result
		const preloadKey = preloadPayloadKey(operation)

		// the identifier for the query variables
		const variableIdentifier = variablesKey(operation)

		// add a local variable right before the return statement
		preloadFn.body.body.splice(
			returnStatementIndex,
			0,
			// @ts-ignore
			// compute the query variables once
			AST.variableDeclaration('const', [
				AST.variableDeclarator(
					AST.identifier(variableIdentifier),
					operation.variableDefinitions && operation.variableDefinitions.length > 0
						? AST.callExpression(
								AST.memberExpression(
									AST.identifier(queryInputFunction(document.artifact.name)),
									AST.identifier('call')
								),
								[requestContext, AST.identifier('page'), AST.identifier('session')]
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
				AST.blockStatement([AST.returnStatement(null)])
			),

			// @ts-ignore
			// perform the fetch and save the value under {preloadKey}
			AST.variableDeclaration('const', [
				AST.variableDeclarator(
					AST.identifier(preloadKey),
					AST.awaitExpression(
						AST.callExpression(AST.identifier('fetchQuery'), [
							requestContext,
							AST.objectExpression([
								AST.objectProperty(
									AST.literal('text'),
									AST.stringLiteral(document.artifact.raw)
								),
								// grab the variables from the function
								AST.objectProperty(
									AST.literal('variables'),
									AST.identifier(variableIdentifier)
								),
							]),
							AST.identifier('session'),
						])
					)
				),
				,
			]),

			// we need to look for errors in the response
			AST.ifStatement(
				AST.memberExpression(AST.identifier(preloadKey), AST.identifier('errors')),
				AST.blockStatement([
					AST.expressionStatement(
						AST.callExpression(
							AST.memberExpression(requestContext, AST.identifier('graphqlErrors')),
							[
								AST.memberExpression(
									AST.identifier(preloadKey),
									AST.identifier('errors')
								),
							]
						)
					),
					AST.returnStatement(null),
				])
			)
		)

		// add the field to the return value of preload
		returnedValue.properties.push(
			// @ts-ignore
			AST.objectProperty(AST.identifier(preloadKey), AST.identifier(preloadKey)),
			// @ts-ignore
			AST.objectProperty(
				AST.identifier(variableIdentifier),
				AST.identifier(variableIdentifier)
			)
		)
	}
}

function processInstance(config: Config, script: Script, queries: EmbeddedGraphqlDocument[]) {
	// the things we need to import from the generate runtime
	const toImport = []

	// check if we need to import query and getQuery under names we can trust
	if (
		!script.content.body.find(
			(statement) =>
				statement.type === 'ImportDeclaration' &&
				statement.source.value === '$houdini' &&
				statement.specifiers.find(
					(importSpecifier) =>
						importSpecifier.type === 'ImportSpecifier' &&
						importSpecifier.imported.type === 'Identifier' &&
						importSpecifier.imported.name === 'query' &&
						importSpecifier.local &&
						importSpecifier.local.name === 'query'
				)
		)
	) {
		toImport.push('query')
	}
	if (
		!script.content.body.find(
			(statement) =>
				statement.type === 'ImportDeclaration' &&
				statement.source.value === '$houdini' &&
				statement.specifiers.find(
					(importSpecifier) =>
						importSpecifier.type === 'ImportSpecifier' &&
						importSpecifier.imported.type === 'Identifier' &&
						importSpecifier.imported.name === 'getQuery' &&
						importSpecifier.local &&
						importSpecifier.local.name === 'getQuery'
				)
		)
	) {
		toImport.push('getQuery')
	}

	if (toImport.length > 0) {
		script.content.body.unshift({
			type: 'ImportDeclaration',
			// @ts-ignore
			source: AST.literal('$houdini'),
			// @ts-ignore
			specifiers: toImport.map((target) =>
				AST.importSpecifier(AST.identifier(target), AST.identifier(target))
			),
		})
	}

	// every document will need to be imported
	for (const document of queries) {
		script.content.body.unshift({
			type: 'ImportDeclaration',
			// @ts-ignore
			source: AST.literal(config.artifactImportPath(document.artifact.name)),
			specifiers: [
				// @ts-ignore
				AST.importDefaultSpecifier(AST.identifier(artifactIdentifier(document.artifact))),
			],
		})
	}

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

		// the identifier for the query variables
		const variableIdentifier = variablesKey(operation)

		const { artifact, parsedDocument } = document

		// prop declarations needs to be added to the top of the document
		script.content.body.splice(
			propInsertIndex,
			0,
			// @ts-ignore: babel's ast does something weird with comments, we won't use em
			AST.exportNamedDeclaration(
				AST.variableDeclaration('let', [AST.variableDeclarator(AST.identifier(preloadKey))])
			),
			// @ts-ignore: babel's ast does something weird with comments, we won't use em
			AST.exportNamedDeclaration(
				AST.variableDeclaration('let', [
					AST.variableDeclarator(AST.identifier(variableIdentifier)),
				])
			),
			AST.variableDeclaration('let', [
				AST.variableDeclarator(
					queryHandlerIdentifier(operation),
					AST.callExpression(AST.identifier('query'), [
						AST.objectExpression([
							AST.objectProperty(
								AST.stringLiteral('initialValue'),
								AST.identifier(
									preloadPayloadKey(
										parsedDocument
											.definitions[0] as graphql.OperationDefinitionNode
									)
								)
							),
							AST.objectProperty(
								AST.stringLiteral('variables'),
								AST.identifier(
									variablesKey(
										parsedDocument
											.definitions[0] as graphql.OperationDefinitionNode
									)
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
						]),
					])
				),
			])
		)

		// reactive statements to synchronize state with query updates need to be at the bottom (where everything
		// will have a definition)
		script.content.body.push(
			// @ts-ignore: babel's ast does something weird with comments, we won't use em
			AST.labeledStatement(
				AST.identifier('$'),
				AST.blockStatement([
					AST.expressionStatement(
						AST.callExpression(
							AST.memberExpression(
								queryHandlerIdentifier(operation),
								AST.identifier('writeData')
							),
							[AST.identifier(preloadKey), AST.identifier(variableIdentifier)]
						)
					),
				])
			)
		)
	}
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

export function artifactIdentifier(artifact: DocumentArtifact) {
	return `_${artifact.name}Artifact`
}
