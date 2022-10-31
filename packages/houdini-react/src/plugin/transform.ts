import { parse } from '@babel/parser'
import * as graphql from 'graphql'
import type { TransformPage } from 'houdini/vite'
import * as recast from 'recast'

export function transform_file(page: TransformPage): { code: string } {
	// parse the content and look for an invocation of the graphql function
	const parsed = parse(page.content, {
		plugins: ['typescript', 'jsx'],
		sourceType: 'module',
	}).program

	recast.visit(parsed, {
		visitCallExpression(node) {
			const { value } = node
			// we only care about invocations of the graphql function
			if (
				!value.callee.name ||
				(value.callee.type === 'Identifier' && value.callee.name !== 'query')
			) {
				return this.traverse(node)
			}

			// the argument passed to the graphql function should be a string
			// with the document body
			if (value.arguments.length !== 1) {
				return this.traverse(node)
			}
			const argument = value.arguments[0]

			// extract the query from template literals as well as strings
			let query = ''
			if (argument.type === 'TemplateLiteral' && argument.quasis.length === 1) {
				query = argument.quasis[0].value.raw
			} else if (argument.type === 'StringLiteral') {
				query = argument.value
			} else {
				console.log(value.callee.name)
			}

			// we want to replace the template tag with an import to the appropriate
			// artifact

			let name = page.config.documentName(graphql.parse(query))
			let artifact_name = ensureArtifactImport({
				config: page.config,
				artifact: { name },
				body: parsed.body,
			})

			node.replace(
				AST.callExpression(AST.identifier('query'), [AST.identifier(artifact_name)])
			)

			return false
		},
	})

	return recast.print(parsed)
}

const AST = recast.types.builders

type Statement = recast.types.namedTypes.Statement
type ImportDeclaration = recast.types.namedTypes.ImportDeclaration

export function ensureArtifactImport({
	config,
	artifact,
	body,
	local,
	withExtension,
}: {
	config: any
	artifact: { name: string }
	body: Statement[]
	local?: string
	withExtension?: boolean
}) {
	return ensureImports({
		body,
		sourceModule: config.artifactImportPath(artifact.name) + (withExtension ? '.js' : ''),
		import: local || `_${artifact.name}Artifact`,
	})
}

export function ensureImports<_Count extends string[] | string>({
	body,
	import: importID,
	sourceModule,
	importKind,
}: {
	body: Statement[]
	import: _Count
	sourceModule: string
	importKind?: 'value' | 'type'
}): _Count {
	const idList = Array.isArray(importID) ? importID : [importID]

	// figure out the list of things to import
	const toImport = idList.filter(
		(identifier) =>
			!body.find(
				(statement) =>
					statement.type === 'ImportDeclaration' &&
					(statement as ImportDeclaration).specifiers!.find(
						(importSpecifier) =>
							(importSpecifier.type === 'ImportSpecifier' &&
								importSpecifier.imported.type === 'Identifier' &&
								importSpecifier.imported.name === identifier &&
								importSpecifier.local!.name === identifier) ||
							(importSpecifier.type === 'ImportDefaultSpecifier' &&
								importSpecifier.local!.type === 'Identifier' &&
								importSpecifier.local!.name === identifier)
					)
			)
	)

	// add the import if it doesn't exist, add it
	if (toImport.length > 0) {
		body.unshift({
			type: 'ImportDeclaration',
			// @ts-ignore
			source: AST.stringLiteral(sourceModule),
			// @ts-ignore
			specifiers: toImport.map((identifier) =>
				!Array.isArray(importID)
					? AST.importDefaultSpecifier(AST.identifier(identifier))
					: AST.importSpecifier(AST.identifier(identifier), AST.identifier(identifier))
			),
			importKind,
		})
	}

	return Array.isArray(importID) ? toImport : toImport[0]
}
