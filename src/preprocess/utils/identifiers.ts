import * as recast from 'recast'

const AST = recast.types.builders

export function artifactIdentifier(artifact: { name: string }) {
	return AST.identifier(`_${artifact.name}Artifact`)
}

export function storeIdentifier(artifact: { name: string }) {
	return AST.identifier(`_${artifact.name}Store`)
}
