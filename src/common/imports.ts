// externals
import * as recast from 'recast'
import { Statement } from '@babel/types'
// locals
import { Config } from '.'

const AST = recast.types.builders

export function ensureStoreImport({
	config,
	artifact,
	body,
	local,
}: {
	config: Config
	artifact: { name: string }
	body: Statement[]
	local?: string
}) {
	return ensureImports({
		config,
		body,
		sourceModule: config.storeImportPath(artifact.name),
		import: local || `_${artifact.name}Store`,
	})
}

export function ensureStoreFactoryImport({
	config,
	artifact,
	body,
}: {
	config: Config
	artifact: { name: string }
	body: Statement[]
}) {
	return ensureImports({
		config,
		body,
		sourceModule: config.storeImportPath(artifact.name),
		import: [`${artifact.name}Store`],
	})
}

export function ensureArtifactImport({
	config,
	artifact,
	body,
	local,
}: {
	config: Config
	artifact: { name: string }
	body: Statement[]
	local?: string
}) {
	return ensureImports({
		config,
		body,
		sourceModule: config.artifactImportPath(artifact.name),
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
					statement.specifiers.find(
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
