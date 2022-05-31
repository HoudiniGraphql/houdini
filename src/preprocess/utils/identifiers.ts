import * as recast from 'recast'

const AST = recast.types.builders

export function storeExportIdentifier(artifact: { name: string }) {
	return AST.identifier(artifact.name)
}
