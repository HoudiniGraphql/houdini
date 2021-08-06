// externals
import { Config } from 'houdini-common'
import fs from 'fs/promises'
import path from 'path'
import { parse as parseJS } from '@babel/parser'
import { asyncWalk } from 'estree-walker'
import * as recast from 'recast'
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
// locals
import { writeFile } from '../../utils'

const AST = recast.types.builders

export async function generateHook(config: Config) {
	await kitHook(config)
}

async function kitHook(config: Config) {
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
		writeFile(
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
