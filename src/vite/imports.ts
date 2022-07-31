// externals
import { Program, ImportDeclaration } from 'estree'
import * as recast from 'recast'
// locals
import { Config } from '../common'

const AST = recast.types.builders

export function ensure_imports<_Count extends string[] | string>({
	config,
	program,
	import: importID,
	sourceModule,
	importKind,
}: {
	config: Config
	program: Program
	import: _Count
	sourceModule: string
	importKind?: 'value' | 'type'
}): _Count {
	const idList = Array.isArray(importID) ? importID : [importID]

	// figure out the list of things to import
	const toImport = idList.filter(
		(identifier) =>
			!program.body.find(
				(statement) =>
					statement.type === 'ImportDeclaration' &&
					(statement as ImportDeclaration).specifiers.find(
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
		program.body.unshift({
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
	program,
	local,
}: {
	config: Config
	artifact: { name: string }
	program: Program
	local?: string
}) {
	return ensure_imports({
		config,
		program,
		sourceModule: config.artifactImportPath(artifact.name),
		import: local || `_${artifact.name}Artifact`,
	})
}

export function store_import({
	config,
	artifact,
	program,
	local,
}: {
	config: Config
	artifact: { name: string }
	program: Program
	local?: string
}) {
	return ensure_imports({
		config,
		program,
		sourceModule: config.storeImportPath(artifact.name),
		import: [`GQL_${artifact.name}`],
	})[0]
}
