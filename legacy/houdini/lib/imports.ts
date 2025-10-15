import * as recast from 'recast'

import type { Config } from './config'

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
	config: Config
	artifact: { name: string }
	body: Statement[]
	local?: string
	withExtension?: boolean
}) {
	return ensureImports({
		config,
		body,
		sourceModule: config.artifactImportPath(artifact.name) + (withExtension ? '.js' : ''),
		import: local || `_${artifact.name}Artifact`,
	})
}

export function ensureImports<_Count extends string[] | string>({
	config,
	body,
	import: importID,
	sourceModule,
	importKind,
}: {
	config: Config
	body: Statement[]
	import: _Count | null
	sourceModule: string
	importKind?: 'value' | 'type'
}): _Count {
	// if import is null then we just need to make sure there is an import for the module
	if (!importID) {
		// if there is already an import for the module then we are done
		if (
			body.find(
				(statement) =>
					statement.type === 'ImportDeclaration' &&
					(statement as ImportDeclaration).source.value === sourceModule
			)
		) {
			return null as any
		}

		// add the import
		body.unshift({
			type: 'ImportDeclaration',
			// @ts-ignore
			source: AST.stringLiteral(sourceModule),
			specifiers: [],
			importKind,
		})

		// we're done
		return null as any
	}

	// we need to find
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
