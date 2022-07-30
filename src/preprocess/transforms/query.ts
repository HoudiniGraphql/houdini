// externals
import * as recast from 'recast'
import * as graphql from 'graphql'
// locals
import {
	Config,
	Script,
	ensureImports,
	ensureArtifactImport,
	ensureStoreFactoryImport,
	walkTaggedDocuments,
	EmbeddedGraphqlDocument,
	TransformDocument,
} from '../../common'
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
			// a variable function

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
		sourceModule: '$houdini/runtime/lib/network',
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
		import: ['getHoudiniContext'],
		sourceModule: '$houdini/runtime/lib/context',
	})
	ensureImports({
		config,
		body: script.content.body,
		import: ['isBrowser'],
		sourceModule: '$houdini/runtime/adapter',
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
												// pull session, stuff, and url from the context
												...['session', 'stuff', 'url'].map((name) =>
													AST.objectProperty(
														AST.identifier(name),
														AST.callExpression(
															AST.memberExpression(
																contextIdentifier,
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
