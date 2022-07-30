import {
	Config,
	EmbeddedGraphqlDocument,
	ensureArtifactImport,
	ensureImports,
	ensureStoreImport,
} from '../../../common'
import * as graphql from 'graphql'
import * as recast from 'recast'
import { CollectedGraphQLDocument } from '../../types'
import { parse as parseJS } from '@babel/parser'
import { readFile } from '../../../../build/cmd/utils'
import { ExportNamedDeclaration } from '@babel/types'
import { Statement } from '@babel/types'
import { namedTypes } from 'ast-types/gen/namedTypes'
import { StatementKind } from 'ast-types/gen/kinds'
import { writeFile } from 'fs-extra'

const AST = recast.types.builders
type Identifier = ReturnType<typeof recast.types.builders.identifier>

export default async function sveltekitGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	// we will only generate things if the project is using svelte kit
	if (config.framework !== 'kit') {
		return
	}

	// a file can have multiple documents in it so we need to first group by filename
	const byFilename = docs.reduce<{ [filename: string]: CollectedGraphQLDocument[] }>(
		(prev, doc) => ({
			...prev,
			[doc.filename]: [...(prev[doc.filename] || []), doc],
		}),
		{}
	)

	const routes = Object.keys(byFilename).filter((filename) => config.isRoute(filename, ''))

	// process every route we run into
	await Promise.all(
		routes.map(async (filename) => {
			// we need to generate a data file that loads every document in the route
			// the file will likely already exist so a lot of the complexity we'll have to manage
			// here is to find a way to safely update the parts we need without destroying the user's code
			const dataFilePath = config.routeDataPath(filename)
			const dataFileContents = (await readFile(dataFilePath)) || ''

			const existing = parseJS(dataFileContents, {
				plugins: ['typescript'],
				sourceType: 'module',
			})

			// add the kit load function
			addKitLoad({
				config,
				body: existing.program.body,
				hasVariables: {},
				queries: byFilename[filename],
			})

			// write the new file contents
			await writeFile(dataFilePath, recast.prettyPrint(existing).code)
		})
	)
}

function addKitLoad({
	config,
	body,
	queries,
	hasVariables,
}: {
	config: Config
	body: Statement[]
	queries: CollectedGraphQLDocument[]
	hasVariables: { [operationName: string]: boolean }
}) {
	// if there is a load function in the body, we need to delete it
	let index = -1
	for (const [i, statement] of body.entries()) {
		if (statement.type !== 'FunctionDeclaration') {
			return
		}

		if (statement.id?.name !== 'load') {
			return
		}

		index = i
		break
	}
	if (index != -1) {
		body.splice(index, 1)
	}

	ensureImports({
		config,
		body,
		import: ['RequestContext'],
		sourceModule: '$houdini/runtime/lib/network',
	})

	// look for any hooks
	let beforeLoadDefinition = findExportedFunction(body, 'beforeLoad')
	let afterLoadDefinition = findExportedFunction(body, 'afterLoad')

	// the name of the variable
	const requestContext = AST.identifier('_houdini_context')

	const loadFn = AST.functionDeclaration(
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
									variablesKey(query.originalDocument.definitions[0])
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
	loadFn.async = true

	// export the function from the module
	body.push(AST.exportNamedDeclaration(loadFn) as ExportNamedDeclaration)

	const retValue = AST.memberExpression(requestContext, AST.identifier('returnValue'))

	// we can start inserting statements at the top of the function
	let insertIndex = 0

	// instantiate the context variable and then thread it through instead of passing `this` directly
	// then look to see if `this.error`, `this.redirect` were called before continuing onto the fetch
	loadFn.body.body.splice(
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

		const operation = document.originalDocument
			.definitions[0] as graphql.OperationDefinitionNode

		// make sure we have an import for the artifact
		const artifactID = ensureArtifactImport({ config, body, artifact: document })
		const storeID = ensureStoreImport({ config, body, artifact: document })

		// figure out the local variable that holds the result
		const preloadKey = preloadPayloadKey(operation)

		// the identifier for the query variables
		const variableIdentifier = variablesKey(operation)

		const name = operation.name!.value

		// add a local variable right before the return statement
		loadFn.body.body.splice(
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
											AST.identifier(queryInputFunction(document.name))
										),
										AST.objectProperty(
											AST.literal('artifact'),
											AST.identifier(artifactID)
										),
									]),
								]
						  )
						: AST.objectExpression([])
				),
			])
		)

		if (hasVariables[name]) {
			loadFn.body.body.splice(
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
			AST.memberExpression(AST.identifier(storeID), AST.identifier('fetch')),
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

			loadFn.body.body.splice(
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
			loadFn.body.body.splice(
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
	loadFn.body.body.splice(-1, 0, ...awaitsAndChecks)

	// add calls to user before/after load functions
	if (beforeLoadDefinition || afterLoadDefinition) {
		let context = [requestContext, config, queries] as const

		if (beforeLoadDefinition) {
			loadFn.body.body.splice(insertIndex, 0, ...loadHookStatements('beforeLoad', ...context))
		}

		if (afterLoadDefinition) {
			loadFn.body.body.splice(-1, 0, ...loadHookStatements('afterLoad', ...context))
		}
	}

	// @ts-ignore
	// add the function to the body
	body.push(loadFn)
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

function loadHookStatements(
	name: 'beforeLoad' | 'afterLoad',
	requestContext: namedTypes.Identifier,
	config: Config,
	queries: CollectedGraphQLDocument[]
) {
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

function afterLoadQueryInput(queries: CollectedGraphQLDocument[]) {
	return AST.objectExpression(
		queries.map(({ originalDocument: { definitions } }) =>
			AST.objectProperty(
				AST.literal(
					(definitions[0] as graphql.OperationDefinitionNode)?.name?.value || null
				),
				AST.identifier(variablesKey(definitions[0]))
			)
		)
	)
}

function afterLoadQueryData(queries: CollectedGraphQLDocument[]) {
	return AST.objectExpression(
		queries.map(({ originalDocument: { definitions } }) =>
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
