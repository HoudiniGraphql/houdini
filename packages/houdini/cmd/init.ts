import path from 'path'
import inquirer from 'inquirer'
import fs from 'fs/promises'
import { Config, getConfig } from 'houdini-common'
import { writeSchema, writeFile } from './utils'
import generateRuntime from './generate'
import * as recast from 'recast'
import { parse as parseJS } from '@babel/parser'
import { asyncWalk } from 'estree-walker'
import {
	CallExpressionKind,
	ExpressionStatementKind,
	FunctionDeclarationKind,
	IdentifierKind,
	ImportDeclarationKind,
	ImportDefaultSpecifierKind,
	MemberExpressionKind,
	ProgramKind,
} from 'ast-types/gen/kinds'

const AST = recast.types.builders

// the init command is responsible for scaffolding a few files
// as well as pulling down the initial schema representation
export default async (_path: string | undefined) => {
	// we need to collect some information from the user before we
	// can continue
	let answers = await inquirer.prompt([
		{
			name: 'url',
			type: 'input',
			message: 'Please enter the URL for your api, including its protocol.',
		},
		{
			name: 'framework',
			type: 'list',
			message: 'Are you using Sapper or SvelteKit?',
			choices: [
				{ value: 'svelte', name: 'No' },
				{ value: 'sapper', name: 'Sapper' },
				{ value: 'kit', name: 'SvelteKit' },
			],
		},
		{
			name: 'module',
			type: 'list',
			message: 'What kind of modules do you want to be generated?',
			when: ({ framework }) => framework === 'svelte',
			choices: [
				{ value: 'commonjs', name: 'CommonJS' },
				{ value: 'esm', name: 'ES Modules' },
			],
		},
		{
			name: 'schemaPath',
			type: 'input',
			default: './schema.graphql',
			validate: (input: string) => {
				const validExtensions = ['json', 'gql', 'graphql']

				const extension = input.split('.').pop()
				if (!extension) {
					return 'Please provide a valid schema path.'
				}
				if (!validExtensions.includes(extension)) {
					return 'The provided schema path should be of type ' + validExtensions.join('|')
				}

				return true
			},
			message:
				'Where should the schema be written to? Valid file extensions are .json, .gql, or .graphql',
		},
	])

	// if the user didn't choose a module type, figure it out from the framework choice
	let module: Config['module'] = answers.module
	if (answers.framework === 'kit') {
		module = 'esm'
	} else if (answers.framework === 'sapper') {
		module = 'commonjs'
	}
	// dry up the framework choice
	const { framework } = answers

	// if no path was given, we'll use cwd
	const targetPath = _path ? path.resolve(_path) : process.cwd()

	// the source directory
	const sourceDir = path.join(targetPath, 'src')
	// the config file path
	const configPath = path.join(targetPath, 'houdini.config.js')
	// where we put the environment
	const environmentPath = path.join(sourceDir, 'environment.js')

	await Promise.all([
		// Get the schema from the url and write it to file
		writeSchema(answers.url, path.join(targetPath, answers.schemaPath)),

		// write the config file
		fs.writeFile(
			configPath,
			configFile({
				schemaPath: answers.schemaPath,
				framework,
				module,
				url: answers.url,
			})
		),

		// write the environment file
		fs.writeFile(environmentPath, networkFile(answers.url)),
	])

	console.log('Welcome to houdini!')
	console.log('Generating initial runtime...')

	const config = await getConfig()

	// generate the initial runtime
	await Promise.all([
		generateRuntime(config),
		// and the initial hook
		generateHook(config),
	])
}

const networkFile = (url: string) => `import { Environment } from '$houdini'

export default new Environment(async function ({ text, variables = {} }) {
	// send the request to the api
	const result = await this.fetch('${url}', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			query: text,
			variables,
		}),
	})

	// parse the result as json
	return await result.json()
})
`

const configFile = ({
	schemaPath,
	framework,
	module,
	url,
}: {
	schemaPath: string
	framework: string
	module: string
	url: string
}) => {
	// the actual config contents
	const configObj = `{
	schemaPath: '${schemaPath}',
	sourceGlob: 'src/**/*.svelte',
	module: '${module}',
	framework: '${framework}',
	apiUrl: '${url}'
}`

	return module === 'esm'
		? // SvelteKit default config
		  `/** @type {import('houdini').ConfigFile} */
const config = ${configObj}

export default config
`
		: // sapper default config
		  `/** @type {import('houdini').ConfigFile} */
const config = ${configObj}

module.exports = config
`
}

export async function generateHook(config: Config) {
	// look up if the hook file already exists
	let existingHookContents = ''
	const jsHookPath = path.join(config.srcPath, 'hook.js')
	let targetPath = jsHookPath
	try {
		if (await fs.stat(targetPath)) {
			existingHookContents = await fs.readFile(targetPath, 'utf-8')
		}
	} catch {
		// fs.stat throws an except if the file doesn't exist
	}
	if (!existingHookContents) {
		targetPath = path.join(config.srcPath, 'hook.ts')
		try {
			if (await fs.stat(targetPath)) {
				existingHookContents = await fs.readFile(targetPath, 'utf-8')
			}
		} catch {
			// fs.stat throws an except if the file doesn't exist
		}
	}

	// if we got this far with no existing content, there is no existing hook
	if (!existingHookContents) {
		// write it
		await writeFile(
			jsHookPath,
			`import cache from '$houdini/runtime/cache'

${recast.print(emptyHandleAST('cache')).code}
`
		)
	}
	// we need to update the existing hook file to include a cache disable
	else {
		await updateHook(config, existingHookContents, targetPath)
	}
}

async function updateHook(config: Config, content: string, targetPath: string) {
	// parse the file contents so we can massage it
	const fileContents = parseJS(content || '', {
		plugins: ['typescript'],
		sourceType: 'module',
	}).program

	let importedCacheName = ''

	// find the function definition
	// @ts-ignore
	let newContents = await asyncWalk(fileContents, {
		enter(node) {
			// look for a handle function
			if (
				!(
					(node.type === 'FunctionDeclaration' &&
						(node as FunctionDeclarationKind).id?.name === 'handle') ||
					(node.type === 'ImportDeclaration' &&
						(node as ImportDeclarationKind).source.value !== '$runtime/houdini/cache' &&
						(node as ImportDeclarationKind).specifiers?.[0]?.type ===
							'ImportDefaultSpecifier')
				)
			) {
				return
			}

			// if we are importing from the cache, use that value
			if (node.type === 'ImportDeclaration') {
				importedCacheName = ((node as ImportDeclarationKind)
					.specifiers![0] as ImportDefaultSpecifierKind).local!.name
				return
			}

			// we are looking at the handle function, look at its top level expressions for a call exprsesion representing
			// cache.disable
			let foundDisable = false
			for (const expression of (node as FunctionDeclarationKind).body.body) {
				// if we found something that's not a call expression of cache.disable
				if (
					expression.type !== 'ExpressionStatement' ||
					(expression as ExpressionStatementKind).expression.type !== 'CallExpression' ||
					((expression as ExpressionStatementKind).expression as CallExpressionKind)
						.callee.type !== 'MemberExpression' ||
					(((expression as ExpressionStatementKind).expression as CallExpressionKind)
						.callee as MemberExpressionKind).object.type !== 'Identifier' ||
					((((expression as ExpressionStatementKind).expression as CallExpressionKind)
						.callee as MemberExpressionKind).object as IdentifierKind).name !==
						importedCacheName ||
					((((expression as ExpressionStatementKind).expression as CallExpressionKind)
						.callee as MemberExpressionKind).property as IdentifierKind).name !==
						'disable'
				) {
					continue
				}

				// we found the disable!
				foundDisable = true
				break
			}

			// if we didn't find the disable, we need to add one
			if (!foundDisable) {
				;(node as FunctionDeclarationKind).body.body.unshift(
					disableCall(importedCacheName || 'cache')
				)
			}
		},
	})

	// if we didn't find an import, add one
	if (!importedCacheName) {
		;(newContents as ProgramKind).body.unshift(
			AST.importDeclaration(
				[AST.importDefaultSpecifier(AST.identifier('cache'))],
				AST.stringLiteral('$houdini/runtime/cache')
			)
		)
	}

	// write the new file contents
	await writeFile(targetPath, recast.print(newContents).code)
}

const disableCall = (cacheID: string) => {
	const result = AST.expressionStatement(
		AST.callExpression(
			AST.memberExpression(AST.identifier(cacheID), AST.identifier('disable')),
			[]
		)
	)

	result.comments = [
		AST.commentBlock(`
    make sure that the server side cache is disabled before every request so that
    we don't accidentally load sensitive user information across sessions when SSR'ing
    a request
`),
	]

	return result
}

const emptyHandleAST = (cacheID: string) => {
	const result = AST.functionDeclaration(
		AST.identifier('handle'),
		[
			AST.objectPattern([
				AST.property('init', AST.identifier('request'), AST.identifier('request')),
				AST.property('init', AST.identifier('render'), AST.identifier('render')),
			]),
		],
		AST.blockStatement([
			disableCall(cacheID),
			AST.returnStatement(
				AST.awaitExpression(
					AST.callExpression(AST.identifier('render'), [AST.identifier('request')])
				)
			),
		])
	)

	result.async = true
	result.comments = [AST.commentBlock(`@type {import('@sveltejs/kit').Handle}`)]

	return result
}
