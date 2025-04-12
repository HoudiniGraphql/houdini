import * as recast from 'recast'

import type { Config } from '../lib/config'
import type { Script } from '../lib/types'
import type { TransformPage } from './houdini'

const AST = recast.types.builders

type Identifier = recast.types.namedTypes.Identifier
type ImportDeclaration = recast.types.namedTypes.ImportDeclaration

export function ensure_imports(args: {
	config: Config
	script: Script
	import?: string
	as?: never
	sourceModule: string
	importKind?: 'value' | 'type' | 'module'
}): { ids: Identifier; added: number }
export function ensure_imports(args: {
	config: Config
	script: Script
	import?: string[]
	as?: string[]
	sourceModule: string
	importKind?: 'value' | 'type' | 'module'
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
	import?: string[] | string
	as?: string[]
	sourceModule: string
	importKind?: 'value' | 'type' | 'module'
}): { ids: Identifier[] | Identifier; added: number } {
	// if there is no import, we can simplify the logic, just look for something with a matching source
	if (!importID) {
		// look for an import from the source module
		const has_import = script.body.find(
			(statement) =>
				statement.type === 'ImportDeclaration' && statement.source.value === sourceModule
		)
		if (!has_import) {
			script.body.unshift({
				type: 'ImportDeclaration',
				source: AST.stringLiteral(sourceModule),
				importKind: importKind === 'type' ? 'type' : 'value',
			})
		}

		return { ids: [], added: has_import ? 0 : 1 }
	}

	const idList = (Array.isArray(importID) ? importID : [importID]).map((id) => AST.identifier(id))

	// figure out the list of things to import
	const toImport = idList.filter(
		(identifier) =>
			!script.body.find(
				(statement) =>
					statement.type === 'ImportDeclaration' &&
					(statement as unknown as ImportDeclaration).specifiers?.find(
						(importSpecifier) =>
							(importSpecifier.type === 'ImportSpecifier' &&
								importSpecifier.imported.type === 'Identifier' &&
								importSpecifier.imported.name === identifier.name &&
								importSpecifier.local?.name === identifier.name) ||
							(importSpecifier.type === 'ImportDefaultSpecifier' &&
								importSpecifier.local?.type === 'Identifier' &&
								importSpecifier.local.name === identifier.name &&
								importSpecifier.local.name === identifier.name)
					)
			)
	)

	// add the import if it doesn't exist, add it
	if (toImport.length > 0) {
		const specifier = (identifier: Identifier, i: number) =>
			importKind !== 'module'
				? !Array.isArray(importID)
					? AST.importDefaultSpecifier(identifier)
					: AST.importSpecifier(identifier, as?.[i] ? AST.identifier(as[i]) : identifier)
				: AST.importNamespaceSpecifier(identifier)

		script.body.unshift({
			type: 'ImportDeclaration',
			source: AST.stringLiteral(sourceModule),
			specifiers: toImport.map(specifier),
			importKind: importKind === 'type' ? 'type' : 'value',
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

export function artifact_import({
	config,
	script,
	artifact,
	local,
}: {
	page: TransformPage
	config: Config
	script: Script
	artifact: { name: string }
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
