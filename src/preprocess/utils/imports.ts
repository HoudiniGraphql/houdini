import * as recast from 'recast'
import { Statement } from '@babel/types'
import { Config } from '../../common'
import { artifactIdentifier, storeIdentifier } from './identifiers'

const AST = recast.types.builders

export function artifactImport(config: Config, { name }: { name: string }): Statement {
	return {
		type: 'ImportDeclaration',
		// @ts-ignore
		source: AST.literal(config.artifactImportPath(name)),
		specifiers: [
			// @ts-ignore
			AST.importDefaultSpecifier(artifactIdentifier({ name })),
		],
	}
}

export function storeImport(config: Config, { name }: { name: string }): Statement {
	return {
		type: 'ImportDeclaration',
		// @ts-ignore
		source: AST.literal(config.storeImportPath(name)),
		specifiers: [
			// @ts-ignore
			AST.importDefaultSpecifier(storeIdentifier({ name })),
		],
	}
}

export function ensureImports(
	config: Config,
	body: Statement[],
	identifiers: string[],
	sourceModule: string = '$houdini'
) {
	const toImport = identifiers.filter(
		(identifier) =>
			!body.find(
				(statement) =>
					statement.type === 'ImportDeclaration' &&
					statement.source.value === sourceModule &&
					statement.specifiers.find(
						(importSpecifier) =>
							importSpecifier.type === 'ImportSpecifier' &&
							importSpecifier.imported.type === 'Identifier' &&
							importSpecifier.imported.name === identifier &&
							importSpecifier.local.name === identifier
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
				AST.importSpecifier(AST.identifier(identifier), AST.identifier(identifier))
			),
		})
	}
}
