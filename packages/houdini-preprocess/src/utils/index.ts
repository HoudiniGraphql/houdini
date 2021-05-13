export { default as walkTaggedDocuments } from './walkTaggedDocuments.js'
export { default as artifactImport } from './artifactImport.js'
export type { EmbeddedGraphqlDocument } from './walkTaggedDocuments.js'

export function artifactIdentifier(artifact: { name: string }) {
	return `_${artifact.name}Artifact`
}
