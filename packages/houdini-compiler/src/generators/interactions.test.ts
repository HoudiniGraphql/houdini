// external imports
import * as recast from 'recast'
import path from 'path'
import { testConfig } from 'houdini-common'
import * as graphql from 'graphql'
import fs from 'fs/promises'
import mockFs from 'mock-fs'
import {
	Program,
	ExportNamedDeclaration,
	ExportDefaultDeclaration,
	FunctionDeclaration,
	IfStatement,
} from 'estree'
import * as typeScriptParser from 'recast/parsers/typescript'

// local imports
import runGenerators from '.'
import { CollectedGraphQLDocument } from '../types'
import { variableNames } from './interactions'

// define the schema
const config = testConfig()

beforeEach(() => {
	mockFs({
		[config.runtimeDirectory]: {
			[config.artifactDirectory]: {},
			[config.interactionDirectory]: {},
		},
	})
})

// make sure the runtime directory is clear before each test
afterEach(mockFs.restore)

test('generates cache updaters', async function () {
	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		// the query needs to ask for a field that the mutation could update
		{
			name: 'TestQuery',
			document: graphql.parse(`query TestQuery { user { id firstName } }`),
		},
		{
			name: 'TestMutation',
			document: graphql.parse(`mutation TestMutation { updateUser { id firstName } }`),
		},
	]

	// run the generators
	await runGenerators(config, docs)

	// look up the files in the mutation directory
	const files = await fs.readdir(config.interactionDirectory)

	// make sure we made two files
	expect(files).toHaveLength(1)
	// and they have the right names
	expect(files).toEqual(
		expect.arrayContaining([
			path.basename(config.interactionPath({ query: 'TestQuery', mutation: 'TestMutation' })),
		])
	)

	// load the contents of the file
	const contents = await fs.readFile(
		config.interactionPath({ query: 'TestQuery', mutation: 'TestMutation' }),
		'utf-8'
	)

	// make sure there is something
	expect(contents).toBeTruthy()

	// parse the contents
	const parsedContents: Program = recast.parse(contents, {
		parser: typeScriptParser,
	}).program
	// sanity check
	expect(parsedContents.type).toBe('Program')

	// find the definition of the interaction handler
	const handlerDefinition = parsedContents.body.find(
		(expression) =>
			(expression.type === 'ExportNamedDeclaration' ||
				expression.type === 'ExportDefaultDeclaration') &&
			expression.declaration?.type === 'FunctionDeclaration' &&
			expression.declaration.id.name === 'applyMutation'
	) as ExportNamedDeclaration | ExportDefaultDeclaration
	// make sure it exists
	expect(handlerDefinition).toBeTruthy()

	// pull out the declaration
	const handler = handlerDefinition.declaration as FunctionDeclaration

	// the handler should be something like:

	// function applyMutation(currentState, set, payload) {
	// 	let updated = false

	// 	// update the update to the current state
	// 	if (currentState.user.id === payload.updateUser.id) {
	// 		currentState.user.firstName = payload.updateUser.firstName
	// 		updated = true
	// 	}

	// 	if (updated) {
	// 		// apply the change
	// 		set(currentState)
	// 	}
	// }

	// make sure there are three arguments in the right order
	expect(handler.params).toHaveLength(3)
	expect(
		handler.params[0].type === 'Identifier' &&
			handler.params[0].name === variableNames.currentState
	)
	expect(handler.params[1].type === 'Identifier' && handler.params[1].name === variableNames.set)
	expect(
		handler.params[2].type === 'Identifier' && handler.params[2].name === variableNames.payload
	)

	// there should be a declaration for the predicate at the top
	const predicateIndex = handler.body.body.findIndex(
		(expression) =>
			expression.type === 'VariableDeclaration' &&
			expression.declarations[0].id.type === 'Identifier' &&
			expression.declarations[0].id.name === variableNames.updatePredicate
	)
	const predicateDeclaration = handler.body.body[predicateIndex]
	expect(predicateDeclaration).toBeTruthy()
	expect(predicateIndex).toEqual(0)

	// there should be an if statement wrapping the updated state
	const updateIfStatment = handler.body.body.find(
		(expression) =>
			expression.type === 'IfStatement' &&
			expression.test.type === 'Identifier' &&
			expression.test.name === variableNames.updatePredicate
	) as IfStatement
	expect(updateIfStatment).toBeTruthy()
	// make sure we invoke set in the body of the if statement
	if (updateIfStatment.consequent.type !== 'BlockStatement') {
		fail('if statement was wrong type')
		return
	}

	// look for an expression like set(updatedState)
	const setCall = updateIfStatment.consequent.body.find(
		(expression) =>
			expression.type === 'ExpressionStatement' &&
			expression.expression.type === 'CallExpression' &&
			expression.expression.callee.type === 'Identifier' &&
			expression.expression.callee.name === variableNames.set &&
			expression.expression.arguments[0].type === 'Identifier' &&
			expression.expression.arguments[0].name === variableNames.updatedState
	)
	expect(setCall).toBeTruthy()
})

test.skip('inline fragments in mutation body count as an intersection', function () {})

test.skip('inline fragments in queries count as an intersection', function () {})

test.skip('inline fragments in fragments count as an intersection', function () {})

test.skip('fragment spread in mutation body', function () {})

test.skip("nested objects that don't have id should also update", function () {})
