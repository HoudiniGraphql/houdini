// external imports
import * as svelte from 'svelte/compiler'
import { Program } from 'estree'
import * as graphql from 'graphql'
import { OperationDocumentKind } from 'houdini-compiler'
import * as recast from 'recast'
import {
	ReturnStatement,
	ObjectExpression,
	Identifier,
	VariableDeclaration,
	AwaitExpression,
	CallExpression,
	FunctionDeclaration,
	Property,
	ExportNamedDeclaration,
} from 'estree'
// local imports
import queryProcessor, { preloadPayloadKey } from './query'
import walkTaggedDocuments, { EmbeddedGraphqlDocument } from '../utils/walkTaggedDocuments'
import { TransformDocument } from '../types'
// mock out the walker so that imports don't actually happen
jest.mock('../utils/walkTaggedDocuments')

const typeBuilders = recast.types.builders

beforeEach(() => {
	// @ts-ignore
	// Clear all instances and calls to constructor and all methods:
	walkTaggedDocuments.mockClear()
})

describe('query preprocessor', function () {
	test('preload initial data', async function () {
		const schema = graphql.buildSchema(`
            type User {
                id: ID!
            }

            type Query {
                viewer: User!
            }
        `)

		const query = `
            query TestQuery {
                viewer {
                    id
                }
            }
        `

		const content = `
            <script>
                const data = query(graphql\`${query}\`)
            </script>
        `

		// the result should be something like:
		// <script context="module">
		//     export async function preload() {
		//         import { fetchQuery } from 'houdini'
		//
		//         const _TestQuery = await fetchQuery({text: query})
		//
		//         return {
		//            _TestQuery: _TestQuery,
		//         }
		//     }
		// </script>
		//
		// <script>
		//     export let _TestQuery
		//
		//     const data = ...
		// </script>

		const parsedQuery = graphql.parse(query)

		// the ast node for the template tag
		const templateNode = typeBuilders.taggedTemplateExpression(
			typeBuilders.identifier('graphql'),
			typeBuilders.templateLiteral(
				[typeBuilders.templateElement({ raw: query, cooked: query }, true)],
				[]
			)
		)

		// @ts-ignore
		// provide a mock implementation for the walker
		walkTaggedDocuments.mockImplementation(
			async (
				doc: TransformDocument,
				script: Program,
				{
					where,
					onTag,
				}: {
					where: (node: graphql.DocumentNode) => boolean
					onTag: (tag: EmbeddedGraphqlDocument) => void
				}
			) => {
				// just invoke the tag callback with the mock data
				onTag({
					parsedDocument: parsedQuery,
					artifact: {
						name: 'TestQuery',
						raw: query,
						kind: 'HoudiniQuery',
					},
					node: {
						...templateNode,
						replaceWith: () => {},
						remove: () => {},
					},
					parent: typeBuilders.callExpression(typeBuilders.identifier('query'), [
						templateNode,
					]),
				})
			}
		)

		// parse the document
		const parsed = svelte.parse(content)

		// build up the document we'll pass to the processor
		const doc = {
			instance: parsed.instance,
			module: parsed.module,
			config: { artifactDirectory: '', artifactDirectoryAlias: '', schema },
			dependencies: [],
			filename: 'base.svelte',
		}

		// run the source through the processor
		await queryProcessor(doc)

		// make sure we added a module script
		expect(doc.module).toBeTruthy()

		// there should be an exported function called "preload"
		const preloadFnExport = doc.module.content.body.find(
			(expression) =>
				expression.type === 'ExportNamedDeclaration' &&
				expression.declaration?.type == 'FunctionDeclaration' &&
				expression.declaration.id?.name === 'preload'
		) as ExportNamedDeclaration

		// sanity checks
		expect(
			preloadFnExport &&
				preloadFnExport.declaration?.type === 'FunctionDeclaration' &&
				preloadFnExport.declaration.async
		).toBeTruthy()
		const preloadFn = preloadFnExport.declaration as FunctionDeclaration

		// pull out the function body
		const functionBody = preloadFn.body

		// the identifier that links the data
		const preloadKey = preloadPayloadKey(
			parsedQuery.definitions[0] as graphql.OperationDefinitionNode
		)

		/// verify the import

		// look for the import
		const importStatement = doc.module.content.body.find(
			(statement) =>
				statement.type === 'ImportDeclaration' &&
				statement.source.value === 'houdini' &&
				statement.specifiers.find(
					(importSpecifier) =>
						importSpecifier.type === 'ImportSpecifier' &&
						importSpecifier.imported.name === 'fetchQuery' &&
						importSpecifier.local.name === 'fetchQuery'
				)
		)
		expect(importStatement).toBeTruthy()

		/// look for the declaration of the local variaable
		const preloadLocalVariable = preloadFn.body.body.find(
			(statement) =>
				statement.type === 'VariableDeclaration' &&
				statement.declarations[0].id.type === 'Identifier' &&
				statement.declarations[0].id.name === preloadKey
		) as VariableDeclaration
		expect(preloadLocalVariable).toBeTruthy()
		expect(preloadLocalVariable.declarations[0].init?.type === 'AwaitExpression')

		// make sure we are awaiting something
		const declarationResult = preloadLocalVariable.declarations[0].init as AwaitExpression
		// we should be await fetchQuery
		expect(declarationResult.argument.type).toEqual('CallExpression')

		const awaitedThing = declarationResult.argument as CallExpression
		expect(
			awaitedThing.callee.type === 'Identifier' && awaitedThing.callee.name === 'fetchQuery'
		).toBeTruthy
		expect(awaitedThing.arguments).toHaveLength(1)

		// grab what we passed to fetchQuery
		const fetchQueryArgument = awaitedThing.arguments[0] as ObjectExpression
		expect(fetchQueryArgument.type).toEqual('ObjectExpression')
		// there should be one property
		expect(fetchQueryArgument.properties).toHaveLength(1)
		const argumentProperty = fetchQueryArgument.properties[0]

		// the key needs to be text
		expect(argumentProperty.key.type === 'Identifier' && argumentProperty.key.name === 'text')
		// and the value needs to be the query
		expect(
			argumentProperty.value.type === 'Identifier' &&
				argumentProperty.value.name === preloadKey
		)

		/// verify the return statement of the function

		// the final thing in the function body should be a return statement
		const returnStatement = functionBody.body.find(
			({ type }) => type === 'ReturnStatement'
		) as ReturnStatement
		expect(returnStatement).toBeTruthy()
		expect(returnStatement.type).toEqual('ReturnStatement')
		// there should be one argument returned
		const returnedObj = returnStatement.argument as ObjectExpression
		expect(returnedObj).toBeTruthy()

		// one of the keys in the response should contain the initial data for the query
		const queryPreloadProperty = returnedObj.properties.find((prop) => {
			return prop.key.type === 'Identifier' && prop.key.name === preloadKey
		}) as Property
		// make sure that it exists
		expect(queryPreloadProperty).toBeTruthy()
		// the value of the key should be an identifier of the same variable
		expect(queryPreloadProperty.value.type).toEqual('Identifier')
		expect((queryPreloadProperty.value as Identifier).name).toEqual(preloadKey)

		// look for the variable exported in the instance
		expect(doc.instance).toBeTruthy()

		// look for an exported variable with the right name
		const componentProp = doc.instance.content.body.find(
			(expression) =>
				expression.type === 'ExportNamedDeclaration' &&
				expression.declaration?.type === 'VariableDeclaration' &&
				expression.declaration?.kind === 'let' &&
				expression.declaration.declarations.length === 1 &&
				expression.declaration.declarations[0].id.type === 'Identifier' &&
				expression.declaration.declarations[0].id.name === preloadKey
		)

		// make sure its there
		expect(componentProp).toBeTruthy()
	})
})
