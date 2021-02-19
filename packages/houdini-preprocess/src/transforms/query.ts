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
// locals
import { TransformDocument } from '../types'
import { selector, walkTaggedDocuments, EmbeddedGraphqlDocument } from '../utils'
const typeBuilders = recast.types.builders

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
			// replace the graphql node with the object
			node.replaceWith(
				typeBuilders.objectExpression([
					typeBuilders.objectProperty(
						typeBuilders.stringLiteral('name'),
						typeBuilders.stringLiteral(artifact.name)
					),
					typeBuilders.objectProperty(
						typeBuilders.stringLiteral('kind'),
						typeBuilders.stringLiteral(artifact.kind)
					),
					typeBuilders.objectProperty(
						typeBuilders.stringLiteral('raw'),
						typeBuilders.stringLiteral(artifact.raw)
					),
					typeBuilders.objectProperty(
						typeBuilders.stringLiteral('initialValue'),
						typeBuilders.identifier(
							preloadPayloadKey(
								tag.parsedDocument.definitions[0] as graphql.OperationDefinitionNode
							)
						)
					),
					typeBuilders.objectProperty(
						typeBuilders.stringLiteral('processResult'),
						selector({
							config: doc.config,
							artifact,
							rootIdentifier: 'data',
							rootType,
							selectionSet: operation.selectionSet,
							// grab values from the immediate response
							pullValuesFromRef: false,
						})
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
			content: typeBuilders.program([]),
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
		const preloadFn = typeBuilders.functionDeclaration(
			typeBuilders.identifier('preload'),
			[
				typeBuilders.identifier('page'),
				typeBuilders.identifier('session')
			],
			// return an object
			typeBuilders.blockStatement([
				typeBuilders.returnStatement(typeBuilders.objectExpression([])),
			])
		)
		// mark the function as async
		preloadFn.async = true

		// hold onto this new declaration
		preloadDefinition = typeBuilders.exportNamedDeclaration(preloadFn) as ExportNamedDeclaration

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
			source: typeBuilders.literal('houdini'),
			specifiers: [
				// @ts-ignore
				typeBuilders.importSpecifier(
					typeBuilders.identifier('fetchQuery'),
					typeBuilders.identifier('fetchQuery')
				),
			],
		})
	}

	let storeUpdateImport = doc.instance.content.body.find(
		(statement) =>
			statement.type === 'ImportDeclaration' &&
			statement.source.value === 'houdini' &&
			statement.specifiers.find(
				(importSpecifier) =>
					importSpecifier.type === 'ImportSpecifier' &&
					importSpecifier.imported.type === 'Identifier' &&
					importSpecifier.imported.name === 'fetchQuery' &&
					importSpecifier.local.name === 'updateStoreData'
			)
	) as ImportDeclaration
	// add the import if it doesn't exist, add it
	if (!storeUpdateImport) {
		doc.instance.content.body.unshift({
			type: 'ImportDeclaration',
			// @ts-ignore
			source: typeBuilders.literal('houdini'),
			specifiers: [
				// @ts-ignore
				typeBuilders.importSpecifier(
					typeBuilders.identifier('updateStoreData'),
					typeBuilders.identifier('updateStoreData')
				),
			],
		})
	}

	/// add the preloaded payload to the return statement

	// find the return statement in the preload function
	const returnStatementIndex = preloadFn.body.body.findIndex(
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

	// every query document we ran into creates a local variable as well as a new key in the returned value of
	// the preload function as well as a prop declaration in the instance script
	for (const document of queries) {
		const operation = document.parsedDocument.definitions[0] as graphql.OperationDefinitionNode
		// figure out the local variable that holds the result
		const preloadKey = preloadPayloadKey(operation)
		
		// prop declarations needs to be added to the top of the document
		doc.instance.content.body.splice(
			propInsertIndex,
			0,
			// @ts-ignore: babel's ast does something weird with comments, we won't use em
			typeBuilders.exportNamedDeclaration(
				typeBuilders.variableDeclaration('let', [
					typeBuilders.variableDeclarator(typeBuilders.identifier(preloadKey)),
				])
			)
		)

		// reactive statements to synchronize state with query updates need to be at the bottom (where everything
		// will have a definition)
		doc.instance.content.body.push(
			// @ts-ignore: babel's ast does something weird with comments, we won't use em
			typeBuilders.labeledStatement(typeBuilders.identifier('$'), typeBuilders.blockStatement([
				typeBuilders.expressionStatement(
					typeBuilders.callExpression(
						typeBuilders.identifier('updateStoreData'), [
							typeBuilders.stringLiteral(document.artifact.name),
							typeBuilders.memberExpression(typeBuilders.identifier(preloadKey), typeBuilders.identifier("data")),
						]
					)
				)
			]))
		)

		// the arguments we'll pass to fetchQuery
		const fetchArgs = [
			typeBuilders.objectProperty(
				typeBuilders.literal('text'),
				typeBuilders.stringLiteral(document.artifact.raw)
			),
		]

		// if there are variables in the operation
		if (operation.variableDefinitions && operation.variableDefinitions.length > 0) { 
			// grab the variables from the function
			fetchArgs.push(typeBuilders.objectProperty(
				typeBuilders.literal('variables'),
				typeBuilders.callExpression(typeBuilders.memberExpression(typeBuilders.identifier(queryInputFunction(document.artifact.name)), typeBuilders.identifier("call")), [
					typeBuilders.identifier('this'),
					typeBuilders.identifier('page'),
					typeBuilders.identifier('session'),
				])
			))
		}

		// add a local variable right before the return statement
		preloadFn.body.body.splice(
			returnStatementIndex,
			0,
			// @ts-ignore
			typeBuilders.variableDeclaration('const', [
				typeBuilders.variableDeclarator(
					typeBuilders.identifier(preloadKey),
					typeBuilders.awaitExpression(
						typeBuilders.callExpression(typeBuilders.identifier('fetchQuery'), [
							typeBuilders.objectExpression(fetchArgs),
						])
					)
				),
				,
			])
		)

		// add the field to the return value of preload
		returnedValue.properties.push(
			// @ts-ignore
			typeBuilders.objectProperty(
				typeBuilders.identifier(preloadKey),
				typeBuilders.identifier(preloadKey)
			)
		)
	}
}

export function preloadPayloadKey(operation: graphql.OperationDefinitionNode): string {
	return `_${operation.name?.value}`
}

export function queryInputFunction(name: string) {
	return `${name}Variables`
}