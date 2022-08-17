import { ImportDeclaration } from 'estree'
import * as recast from 'recast'

import { Config, Script } from '../common'

const AST = recast.types.builders

type Identifier = recast.types.namedTypes.Identifier

export function ensure_imports({
	config,
	script,
	import: importID,
	sourceModule,
	importKind,
}: {
	config: Config
	script: Script
	import: string
	as?: never
	sourceModule: string
	importKind?: 'value' | 'type'
}): { ids: Identifier; added: number }
export function ensure_imports({
	config,
	script,
	import: importID,
	sourceModule,
	importKind,
}: {
	config: Config
	script: Script
	import: string[]
	as?: string[]
	sourceModule: string
	importKind?: 'value' | 'type'
}): { ids: Identifier[]; added: number }
export function ensure_imports({
	config,
	script,
	import: importID,
	sourceModule,
	importKind,
	as,
}: {
	config: Config
	script: Script
	import: string[] | string
	as?: string[]
	sourceModule: string
	importKind?: 'value' | 'type'
}): { ids: Identifier[] | Identifier; added: number } {
	const idList = (Array.isArray(importID) ? importID : [importID]).map((id) => AST.identifier(id))

	// figure out the list of things to import
	const toImport = idList.filter(
		(identifier) =>
			!script.body.find(
				(statement) =>
					statement.type === 'ImportDeclaration' &&
					(statement as unknown as ImportDeclaration).specifiers.find(
						(importSpecifier) =>
							(importSpecifier.type === 'ImportSpecifier' &&
								importSpecifier.imported.type === 'Identifier' &&
								importSpecifier.imported.name === identifier.name &&
								importSpecifier.local.name === identifier.name) ||
							(importSpecifier.type === 'ImportDefaultSpecifier' &&
								importSpecifier.local.type === 'Identifier' &&
								importSpecifier.local.name === identifier.name &&
								importSpecifier.local.name === identifier.name)
					)
			)
	)

	// add the import if it doesn't exist, add it
	if (toImport.length > 0) {
		script.body.unshift({
			type: 'ImportDeclaration',
			source: AST.stringLiteral(sourceModule),
			specifiers: toImport.map((identifier, i) =>
				!Array.isArray(importID)
					? AST.importDefaultSpecifier(identifier)
					: AST.importSpecifier(identifier, as?.[i] ? AST.identifier(as[i]) : identifier)
			),
			importKind,
		})
	}

	// the resulting identifiers might have been aliased the as aliases if they exist
	for (const [i, target] of (as ?? []).entries()) {
		if (target) {
			idList[i] = AST.identifier(target)
		}
	}

	return {
		ids: Array.isArray(importID) ? idList : idList[0],
		added: toImport.length,
	}
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
}): { id: Identifier; added: number } {
	const { ids, added } = ensure_imports({
		config,
		script,
		sourceModule: config.storeImportPath(artifact.name),
		import: `GQL_${artifact.name}`,
	})

	return { id: ids, added }
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
	const { ids, added } = ensure_imports({
		config,
		script,
		sourceModule: config.artifactImportPath(artifact.name),
		import: local || `_${artifact.name}Artifact`,
	})
	return { id: ids, added }
}
