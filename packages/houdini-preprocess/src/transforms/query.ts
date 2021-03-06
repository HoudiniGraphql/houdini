// externals
import * as recast from 'recast'
import * as graphql from 'graphql'
import {
	ExportNamedDeclaration,
	FunctionDeclaration,
	ReturnStatement,
	ImportDeclaration,
} from '@babel/types'
import { Config } from 'houdini-common'
import { QueryArtifact } from 'houdini'
// locals
import { TransformDocument } from '../types'
import { selector, walkTaggedDocuments, EmbeddedGraphqlDocument, selectionAST } from '../utils'
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
			const { artifact, parsedDocument, node } = tag

			// figure out the root type of the fragment
			const operation = parsedDocument.definitions[0] as graphql.OperationDefinitionNode

			// add the document to the list
			queries.push(tag)

			// we're going to replace the graphql tag with an object containing the information the runtime needs
			node.replaceWith(
				AST.objectExpression([
					AST.objectProperty(AST.stringLiteral('name'), AST.stringLiteral(artifact.name)),
					AST.objectProperty(AST.stringLiteral('kind'), AST.stringLiteral(artifact.kind)),
					AST.objectProperty(AST.stringLiteral('raw'), AST.stringLiteral(artifact.raw)),
					AST.objectProperty(
						AST.stringLiteral('initialValue'),
						AST.identifier(
							preloadPayloadKey(
								tag.parsedDocument.definitions[0] as graphql.OperationDefinitionNode
							)
						)
					),
					AST.objectProperty(
						AST.stringLiteral('processResult'),
						selector({
							config: doc.config,
							artifact,
							parsedDocument,
							rootIdentifier: 'data',
							rootType,
							selectionSet: operation.selectionSet,
							// grab values from the immediate response
							pullValuesFromRef: false,
							// make sure we can pass in variables
							root: true,
						})
					),
					AST.objectProperty(
						AST.stringLiteral('variables'),
						AST.identifier(
							variablesKey(
								tag.parsedDocument.definitions[0] as graphql.OperationDefinitionNode
							)
						)
					),
					AST.objectProperty(
						AST.literal('response'),
						selectionAST((artifact as QueryArtifact).response)
					),
					AST.objectProperty(
						AST.literal('selection'),
						selectionAST((artifact as QueryArtifact).selection)
					),
				])
			)
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

	// look for a preload definition
	let preloadDefinition = doc.module.content.body.find(
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
		doc.module.content.body.push(preloadDefinition)
	}
	const preloadFn = preloadDefinition.declaration as FunctionDeclaration

	/// add the imports if they're  not there

	let fetchQueryImport = doc.module.content.body.find(
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
		doc.module.content.body.unshift({
			type: 'ImportDeclaration',
			// @ts-ignore
			source: AST.literal('$houdini'),
			specifiers: [
				// @ts-ignore
				AST.importSpecifier(AST.identifier('fetchQuery'), AST.identifier('fetchQuery')),
			],
		})
	}

	let storeUpdateImport = doc.instance.content.body.find(
		(statement) =>
			statement.type === 'ImportDeclaration' &&
			statement.source.value === '$houdini' &&
			statement.specifiers.find(
				(importSpecifier) =>
					importSpecifier.type === 'ImportSpecifier' &&
					importSpecifier.imported.type === 'Identifier' &&
					importSpecifier.imported.name === 'updateStoreData' &&
					importSpecifier.local.name === 'updateStoreData'
			)
	) as ImportDeclaration
	// add the import if it doesn't exist, add it
	if (!storeUpdateImport) {
		doc.instance.content.body.unshift({
			type: 'ImportDeclaration',
			// @ts-ignore
			source: AST.literal('$houdini'),
			specifiers: [
				// @ts-ignore
				AST.importSpecifier(
					AST.identifier('updateStoreData'),
					AST.identifier('updateStoreData')
				),
			],
		})
	}

	let requestCtxImport = doc.module.content.body.find(
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
		doc.module.content.body.unshift({
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

	// add props to the component for every query while we're here

	// find the first non import statement
	const propInsertIndex = doc.instance.content.body.findIndex(
		(expression) => expression.type !== 'ImportDeclaration'
	)

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

	// this happens for every document in the page, make sure we handle that correctly.

	// every query document we ran into creates a local variable as well as a new key in the returned value of
	// the preload function as well as a prop declaration in the instance script
	for (const document of queries) {
		const operation = document.parsedDocument.definitions[0] as graphql.OperationDefinitionNode
		// figure out the local variable that holds the result
		const preloadKey = preloadPayloadKey(operation)

		// the identifier for the query variables
		const variableIdentifier = variablesKey(operation)

		// prop declarations needs to be added to the top of the document
		doc.instance.content.body.splice(
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
			)
		)

		// reactive statements to synchronize state with query updates need to be at the bottom (where everything
		// will have a definition)
		doc.instance.content.body.push(
			// @ts-ignore: babel's ast does something weird with comments, we won't use em
			AST.labeledStatement(
				AST.identifier('$'),
				AST.blockStatement([
					AST.expressionStatement(
						AST.callExpression(AST.identifier('updateStoreData'), [
							AST.stringLiteral(document.artifact.name),
							AST.identifier(preloadKey),
							AST.identifier(variableIdentifier),
						])
					),
				])
			)
		)

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

export function preloadPayloadKey(operation: graphql.OperationDefinitionNode): string {
	return `_${operation.name?.value}`
}

export function variablesKey(operation: graphql.OperationDefinitionNode): string {
	return `_${operation.name?.value}_Input`
}

export function queryInputFunction(name: string) {
	return `${name}Variables`
}
