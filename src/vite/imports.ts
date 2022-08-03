// externals
import { ImportDeclaration } from 'estree'
import * as recast from 'recast'
// locals
import { Config } from '../common/config'
import { Script } from '../common/types'

const AST = recast.types.builders

export function ensure_imports<_Count extends string[] | string>({
	config,
	script,
	import: importID,
	sourceModule,
	importKind,
}: {
	config: Config
	script: Script
	import: _Count
	sourceModule: string
	importKind?: 'value' | 'type'
}): _Count {
	const idList = Array.isArray(importID) ? importID : [importID]

	// figure out the list of things to import
	const toImport = idList.filter(
		(identifier) =>
			!script.body.find(
				(statement) =>
					statement.type === 'ImportDeclaration' &&
					((statement as unknown) as ImportDeclaration).specifiers.find(
						(importSpecifier) =>
							(importSpecifier.type === 'ImportSpecifier' &&
								importSpecifier.imported.type === 'Identifier' &&
								importSpecifier.imported.name === identifier &&
								importSpecifier.local.name === identifier) ||
							(importSpecifier.type === 'ImportDefaultSpecifier' &&
								importSpecifier.local.type === 'Identifier' &&
								importSpecifier.local.name === identifier &&
								importSpecifier.local.name === identifier)
					)
			)
	)

	// add the import if it doesn't exist, add it
	if (toImport.length > 0) {
		script.body.unshift({
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

	return Array.isArray(importID) ? idList : idList[0]
}

export function artifact_import({
	config,
	artifact,
	script,
	local,
}: {
	config: Config
	artifact: { name: string }
	script: Script
	local?: string
}) {
	return ensure_imports({
		config,
		script,
		sourceModule: config.artifactImportPath(artifact.name),
		import: local || `_${artifact.name}Artifact`,
	})
}

export function store_import({
	config,
	artifact,
	script,
	local,
}: {
	config: Config
	artifact: { name: string }
	script: Script
	local?: string
}) {
	return ensure_imports({
		config,
		script,
		sourceModule: config.storeImportPath(artifact.name),
		import: [`GQL_${artifact.name}`],
	})[0]
}
